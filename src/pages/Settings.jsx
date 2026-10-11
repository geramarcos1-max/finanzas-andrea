import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { removeAllReceipts } from '../lib/receipts'
import { mxn0, today } from '../lib/format'
import { FormModal, Item, PageHead, confirmDel, run, toast } from '../ui'

function Rules({ D }) {
  const [open, setOpen] = useState(false)
  const s = D.settings
  async function save(v) {
    const { error } = await supabase.from('settings').upsert({ id: 1, loan_limit: v.loan || 0 })
    if (error) return error.message
    await D.reload(); toast('Guardado'); return true
  }
  return (
    <>
      <h2>Préstamos familiares</h2>
      <div className="list">
        <Item title="Límite para prestar por persona al mes" right={mxn0(s.loan_limit)} />
      </div>
      <p style={{ marginTop: 10 }}><button className="btn" onClick={() => setOpen(true)}>Cambiar límite</button></p>
      {open && <FormModal title="Límite de préstamos" fields={[{ key: 'loan', label: 'Límite por persona al mes', type: 'money' }]} onClose={() => setOpen(false)} onSave={save}
        initial={{ loan: String(s.loan_limit || '') }} />}
    </>
  )
}

function Sources({ D }) {
  const [modal, setModal] = useState(null)
  const save = (ed) => async (v) => (await run(ed ? supabase.from('income_sources').update({ name: v.name.trim() }).eq('id', ed.id) : supabase.from('income_sources').insert({ name: v.name.trim() }), D.reload, 'Guardado')) ? true : 'No se pudo guardar (¿nombre repetido?)'
  const del = async (s) => {
    if (D.incomes.some((i) => i.source_id === s.id)) {
      if (window.confirm(`"${s.name}" ya tiene ingresos, así que se archivará. ¿Continuar?`)) await run(supabase.from('income_sources').update({ archived: true }).eq('id', s.id), D.reload, 'Archivada')
    } else if (confirmDel(s.name)) await run(supabase.from('income_sources').delete().eq('id', s.id), D.reload, 'Eliminada')
  }
  return (
    <>
      <h2>Fuentes de ingreso</h2>
      <div className="list">
        {D.income_sources.filter((s) => !s.archived).map((s) => (
          <Item key={s.id} title={s.name} actions={<><button className="link edit" onClick={() => setModal({ ed: s })}>Editar</button><button className="link" onClick={() => del(s)}>Quitar</button></>} />
        ))}
      </div>
      <p style={{ marginTop: 10 }}><button className="btn" onClick={() => setModal({})}>+ Nueva fuente</button></p>
      {modal && <FormModal title={modal.ed ? 'Editar fuente' : 'Nueva fuente'} fields={[{ key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej. Freelance' }]}
        initial={modal.ed ? { name: modal.ed.name } : {}} onSave={save(modal.ed)} onClose={() => setModal(null)} />}
    </>
  )
}

function Categories({ D }) {
  const [modal, setModal] = useState(false)
  const list = D.categories.filter((c) => c.kind === 'expense')
  return (
    <>
      <h2>Categorías de gasto</h2>
      <div className="list">
        {list.map((c) => (
          <Item key={c.id} title={<span style={{ opacity: c.archived ? 0.45 : 1 }}>{c.name}</span>}
            actions={<button className="link edit" onClick={() => run(supabase.from('categories').update({ archived: !c.archived }).eq('id', c.id), D.reload)}>{c.archived ? 'Restaurar' : 'Ocultar'}</button>} />
        ))}
      </div>
      <p style={{ marginTop: 10 }}><button className="btn" onClick={() => setModal(true)}>+ Nueva categoría</button></p>
      {modal && <FormModal title="Nueva categoría" fields={[{ key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej. Mascotas' }]} onClose={() => setModal(false)}
        onSave={async (v) => (await run(supabase.from('categories').insert({ name: v.name.trim(), kind: 'expense', nature: 'variable' }), D.reload, 'Guardado')) ? true : 'No se pudo guardar'} />}
    </>
  )
}

function Access() {
  const [emails, setEmails] = useState([])
  const [email, setEmail] = useState('')
  const load = () => supabase.from('allowed_emails').select('email').order('created_at').then(({ data }) => setEmails((data || []).map((x) => x.email)))
  useEffect(() => { load() }, [])
  const add = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    await run(supabase.from('allowed_emails').insert({ email: email.trim().toLowerCase() }), load, 'Acceso otorgado')
    setEmail('')
  }
  return (
    <>
      <h2>Quién puede entrar</h2>
      <div className="list">
        {emails.map((m) => (
          <Item key={m} title={m} actions={<button className="link" onClick={() => window.confirm(`¿Quitar acceso a ${m}?`) && run(supabase.from('allowed_emails').delete().eq('email', m), load, 'Acceso quitado')}>Quitar</button>} />
        ))}
      </div>
      <form onSubmit={add} className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
        <input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn">Autorizar</button>
      </form>
    </>
  )
}

function Password() {
  const [pw, setPw] = useState('')
  const change = async (e) => {
    e.preventDefault()
    if (pw.length < 8) return toast('Mínimo 8 caracteres')
    const { error } = await supabase.auth.updateUser({ password: pw })
    toast(error ? '⚠️ ' + error.message : 'Contraseña actualizada'); setPw('')
  }
  return (
    <>
      <h2>Cambiar contraseña</h2>
      <form onSubmit={change} className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn">Guardar</button>
      </form>
    </>
  )
}

function Backup({ D }) {
  function download() {
    const { loading, error, reload, ...data } = D
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `finanzas-andrea-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <h2>Respaldo</h2>
      <p className="note">Descarga una copia de todos tus datos. Hazlo de vez en cuando.</p>
      <button className="btn" onClick={download}>Descargar respaldo (.json)</button>
    </>
  )
}

function Reset({ D }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <h2>Empezar de cero</h2>
      <p className="note">Borra todas las cuentas, ingresos, gastos, metas, pagos fijos y préstamos, y vuelve a pedir “¿cuánto dinero tienes hoy?”. Se conservan tus reglas, fuentes de ingreso y categorías. <b>No se puede deshacer.</b></p>
      <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => setOpen(true)}>Borrar todo y empezar de cero</button>
      {open && <FormModal title="¿Borrar todo?" sub="Escribe la palabra BORRAR para confirmar." onClose={() => setOpen(false)} saveLabel="Sí, borrar todo"
        fields={[{ key: 'word', label: 'Confirmación', type: 'text', required: true, placeholder: 'BORRAR' }]}
        onSave={async (v) => {
          if (v.word.trim().toUpperCase() !== 'BORRAR') return 'Escribe BORRAR tal cual para continuar.'
          try { await removeAllReceipts() } catch { /* si no hay fotos o falla, se sigue con el borrado */ }
          return (await run(supabase.rpc('reset_all_data'), D.reload, 'Listo, todo quedó en ceros')) ? true : 'No se pudo borrar'
        }} />}
    </>
  )
}

export default function Settings() {
  const D = useData()
  return (
    <>
      <PageHead title="Configuración" sub="Ajustes generales de la app." />
      <Rules D={D} />
      <Sources D={D} />
      <Categories D={D} />
      <Access />
      <Password />
      <Backup D={D} />
      <Reset D={D} />
    </>
  )
}
