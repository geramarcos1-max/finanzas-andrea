// Fotos de tickets / comprobantes de gastos. Se guardan en un almacén privado de Supabase.
import { supabase } from './supabase'

const BUCKET = 'receipts'
const MAX_BYTES = 5 * 1024 * 1024

// Reduce la foto (máx. 1600 px, JPEG) para que pese poco y no llene el almacenamiento.
export async function prepareImage(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('Elige una imagen (foto o captura de pantalla).')
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (blob) return blob
  } catch { /* si el navegador no puede reducirla, se sube tal cual si no pesa demasiado */ }
  if (file.size > MAX_BYTES) throw new Error('La foto pesa demasiado (máximo 5 MB).')
  return file
}

export async function uploadReceipt(file) {
  const blob = await prepareImage(file)
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw new Error(error.message)
  return path
}

export async function removeReceipt(path) {
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// Borra todas las fotos (se usa al "Empezar de cero")
export async function removeAllReceipts() {
  const store = supabase.storage.from(BUCKET)
  const { data: root } = await store.list('', { limit: 1000 })
  const paths = []
  for (const item of root || []) {
    if (item.id) { paths.push(item.name); continue }            // archivo suelto
    const { data: files } = await store.list(item.name, { limit: 1000 })   // carpeta (año-mes)
    for (const f of files || []) paths.push(`${item.name}/${f.name}`)
  }
  for (let i = 0; i < paths.length; i += 100) await store.remove(paths.slice(i, i + 100))
}
