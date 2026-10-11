import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { DEFAULT_PRIORITY, GROUPS } from '../lib/calc'
import { mxn0, today } from '../lib/format'
import { Empty, FormModal, Item, PageHead, Pill, confirmDel, run, toast } from '../ui'

function Rules({ D }) {
  const [open, setOpen] = useState(false)
  const personal = D.envelopes.find((e) => e.kind === 'personal')
  const emergency = D.envelopes.find((e) => e.kind === 'emergency')
  const s = D.settings
  const fields = [
    { key: 'personal', label: 'Gastos personales al mes', type: 'money' },
    { key: 'emergency', label: 'Aporte mensual al fondo de emergencia', type: 'money' },
    { key: 'pct', label: '% de cada ingreso a largo plazo', type: 'number', min: 0, max: 100 },
    { key: 'loan', label: 'Límite de préstamo por persona al mes', type: 'money' },
  ]
  async function save(v) {
    const r = await Promise.all([
      supabase.from('envelopes').update({ monthly_amount: v.personal || 0 }).eq('id', personal.id),
      supabase.from('envelopes').update({ monthly_amount: v.emergency || 0 }).eq('id', emergency.id),
      supabase.from('settings').upsert({ id: 1, longterm_pct: Number(v.pct) || 0, loan_limit: v.loan || 0, priority: s.priority }),
    ])
    const bad = r.find((x) => x.error)
    if (bad) return bad.error.message
    await D.reload(); toast('Reglas guardadas'); return true
  }
  return (
    <>
      <h2>Reglas del reparto</h2>
      <div className="list">
        <Item title="Gastos personales al mes" right={mxn0(personal?.monthly_amount)} />
        <Item title="Aporte mensual al fondo de emergencia" right={mxn0(emergency?.monthly_amount)} />
        <Item title="% de cada ingreso a largo plazo" right={`${s.longterm_pct}%`} />
        <Item title="Límite de préstamo por persona al mes" right={mxn0(s.loan_limit)} />
      </div>
      <p style={{ marginTop: 10 }}><button className="btn" onClick={() => setOpen(true)}>Editar reglas</button></p>
      {open && <FormModal title="Reglas del reparto" fields={fields} onClose={() => setOpen(false)} onSave={save}
        initial={{ personal: String(personal?.monthly_amount || ''), emergency: String(emergency?.monthly_amount || ''), pct: s.longterm_pct, loan: String(s.loan_limit || '') }} />}
    </>
  )
}

function Priority({ D }) {
  const order = [...(D.settings.priority || []), ...DEFAULT_PRIORITY].filter((g, i, a) => a.indexOf(g) === i && GROUPS[g])
  async function move(i, d) {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]; [next[i], next[j]] = [next[j], next[i]]
    await run(supabase.from('settings').upsert({ id: 1, longterm_pct: D.settings.longterm_pct, loan_limit: D.settings.loan_limit, priority: next }), D.reload, 'Orden guardado')
  }
  return (
    <>
      <h2>Orden del reparto</h2>
      <p className="note">Cada ingreso cubre primero lo que está arriba y luego baja. Lo que sobre al final va a tu ahorro para el futuro.</p>
      <div className="list">
        {order.map((g, i) => (
          <Item key={g} title={<><Pill>{i + 1}</Pill> {GROUPS[g]}</>}
            actions={<><button className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button className="btn sm" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button></>} />
        ))}
      </div>
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

export default function Settings() {
  const D = useData()
  return (
    <>
      <PageHead title="Configuración" sub="Reglas que usa el sistema para proponer el reparto de cada ingreso." />
      <Rules D={D} />
      <Priority D={D} />
      <Sources D={D} />
      <Categories D={D} />
      <Access />
      <Password />
      <Backup D={D} />
    </>
  )
}
