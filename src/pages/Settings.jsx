import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { mxn } from '../lib/format'
import { Empty, ErrorMsg } from '../ui'

async function run(promise, reload) {
  const { error } = await promise
  if (error) alert(error.message); else reload && reload()
}

function Categories({ D }) {
  const blank = { name: '', kind: 'expense', nature: 'variable' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const add = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    await run(supabase.from('categories').insert({ ...f, name: f.name.trim() }), D.reload)
    setF(blank)
  }
  const group = (kind, title) => (
    <div style={{ flex: 1, minWidth: 260 }}>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <div className="list">
        {D.categories.filter((c) => c.kind === kind).map((c) => (
          <div className="row" key={c.id} style={{ padding: '7px 0', opacity: c.archived ? 0.45 : 1 }}>
            <span className="dot" style={{ background: c.color || '#c7c7cc' }} />
            <span className="grow">{c.name}</span>
            <span className="chip">{c.nature === 'fixed' ? 'Fijo' : 'Variable'}</span>
            <button className="btn ghost sm" onClick={() => run(supabase.from('categories').update({ archived: !c.archived }).eq('id', c.id), D.reload)}>{c.archived ? 'Restaurar' : 'Ocultar'}</button>
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <div className="card">
      <h2>Categorías</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{group('expense', 'Gastos')}{group('income', 'Ingresos')}</div>
      <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
        <div><label>Nueva categoría</label><input value={f.name} onChange={set('name')} placeholder="Ej. Mascotas" /></div>
        <div><label>Tipo</label><select value={f.kind} onChange={set('kind')}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></div>
        <div><label>Naturaleza</label><select value={f.nature} onChange={set('nature')}><option value="variable">Variable</option><option value="fixed">Fija</option></select></div>
        <button className="btn">Agregar</button>
      </form>
    </div>
  )
}

function Recurring({ D }) {
  const blank = { name: '', kind: 'expense', amount: '', day_of_month: '1', account_id: '', category_id: '', debt_id: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const accounts = D.accounts.filter((a) => !a.archived)
  const add = async (e) => {
    e.preventDefault(); setError('')
    if (!f.name.trim() || !(Number(f.amount) > 0)) return setError('Escribe un nombre y un monto.')
    await run(supabase.from('recurring_items').insert({
      name: f.name.trim(), kind: f.kind, amount: Number(f.amount), day_of_month: Number(f.day_of_month),
      account_id: f.account_id || accounts[0]?.id || null, category_id: f.category_id || null, debt_id: f.kind === 'expense' ? f.debt_id || null : null,
    }), D.reload)
    setF(blank)
  }
  return (
    <div className="card">
      <h2>Ingresos y gastos fijos</h2>
      <p className="small muted" style={{ marginTop: -6 }}>Configúralos una vez; cada mes aparecerán en el Resumen como “Pendientes de registrar” para confirmarlos con un clic.</p>
      {D.recurring.length === 0 ? <Empty>Aún no hay movimientos fijos (sueldo, renta, carro, suscripciones…).</Empty> : (
        <div className="list">
          {D.recurring.map((r) => (
            <div className="row" key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
              <div className="grow"><div className="title">{r.name}</div>
                <div className="small muted">Día {r.day_of_month} · {r.kind === 'income' ? 'Ingreso' : 'Gasto'} · {D.accounts.find((a) => a.id === r.account_id)?.name || 'sin cuenta'}</div></div>
              <span className={`amount ${r.kind === 'income' ? 'pos' : ''}`}>{mxn(r.amount)}</span>
              <button className="btn ghost sm" onClick={() => run(supabase.from('recurring_items').update({ active: !r.active }).eq('id', r.id), D.reload)}>{r.active ? 'Pausar' : 'Activar'}</button>
              <button className="btn danger sm" onClick={() => confirm(`¿Eliminar "${r.name}"?`) && run(supabase.from('recurring_items').delete().eq('id', r.id), D.reload)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
        <div><label>Nombre</label><input value={f.name} onChange={set('name')} placeholder="Sueldo, Pago del carro…" /></div>
        <div><label>Tipo</label><select value={f.kind} onChange={set('kind')}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></div>
        <div><label>Monto</label><input type="number" step="0.01" value={f.amount} onChange={set('amount')} /></div>
        <div><label>Día del mes</label><input type="number" min="1" max="31" value={f.day_of_month} onChange={set('day_of_month')} /></div>
        <div><label>Cuenta</label><select value={f.account_id || accounts[0]?.id || ''} onChange={set('account_id')}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label>Categoría</label><select value={f.category_id} onChange={set('category_id')}><option value="">Sin categoría</option>{D.categories.filter((c) => !c.archived && c.kind === f.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {f.kind === 'expense' && D.debts.some((d) => !d.archived) && (
          <div><label>Abona a deuda</label><select value={f.debt_id} onChange={set('debt_id')}><option value="">No</option>{D.debts.filter((d) => !d.archived).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        )}
        <button className="btn">Agregar</button>
      </form>
      <ErrorMsg msg={error} />
    </div>
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
    await run(supabase.from('allowed_emails').insert({ email: email.trim().toLowerCase() }), load)
    setEmail('')
  }
  return (
    <div className="card">
      <h2>Quién puede entrar</h2>
      <div className="list">
        {emails.map((m) => (
          <div className="row" key={m}><span className="grow">{m}</span>
            <button className="btn danger sm" onClick={() => confirm(`¿Quitar acceso a ${m}?`) && run(supabase.from('allowed_emails').delete().eq('email', m), load)}>Quitar</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn">Autorizar</button>
      </form>
    </div>
  )
}

function Password() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const change = async (e) => {
    e.preventDefault()
    if (pw.length < 8) return setMsg('Mínimo 8 caracteres.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? error.message : 'Contraseña actualizada ✅'); setPw('')
  }
  return (
    <form className="card" onSubmit={change}>
      <h2>Cambiar contraseña</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn">Guardar</button>
      </div>
      {msg && <div className="small muted" style={{ marginTop: 8 }}>{msg}</div>}
    </form>
  )
}

export default function Settings() {
  const D = useData()
  return (
    <>
      <div className="page-head"><h1>Ajustes</h1></div>
      <div className="stack" style={{ gap: 16 }}>
        <Recurring D={D} />
        <Categories D={D} />
        <Access />
        <Password />
      </div>
    </>
  )
}
