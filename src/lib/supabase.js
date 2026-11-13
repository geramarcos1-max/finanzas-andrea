import { createClient } from '@supabase/supabase-js'

// Si la persona llegó desde el enlace del correo de "olvidé mi contraseña", la URL trae type=recovery.
// Hay que leerlo antes de crear el cliente, porque este limpia la URL al procesar el enlace.
export const startedInRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)
