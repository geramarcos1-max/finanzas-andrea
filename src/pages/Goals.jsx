import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { diffDays, fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { Bar, Empty, ErrorMsg } from '../ui'

function GoalCard({ g, onChange }) {
  const [amt, setAmt] = useState('')
  const saved = Number(g.saved), target = Number(g.target_amount)
  const done = saved >= target
  const remaining = Math.max(target - saved, 0)
  let hint = null
  if (!done && g.target_date) {
    const days = diffDays(today(), g.target_date)
    if (days <= 0) hint = 'La fecha ya venció'
    else {
      const months = Math.max(days / 30.44, 1)
      hint = `Necesitas ahorrar ${mxn0(remaining / months)} al mes (${mxn0(remaining / (days / 7))} por semana)`
    }
  }

  async function contribute(sign) {
    const v = Number(amt)
    if (!(v > 0)) return
    const { error } = await supabase.from('goal_contributions').insert({ goal_id: g.id, amount: sign * v, date: today() })
    if (error) return alert(error.message)
    setAmt(''); onChange()
  }
  async function remove() {
    if (!confirm(`¿Eliminar la meta "${g.name}"?`)) return
    await supabase.from('goals').delete().eq('id', g.id)
    onChange()
  }

  return (
    <div className="card stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <b style={{ fontSize: 17 }}>{done ? '🎉 ' : ''}{g.name}</b>
          <div className="small muted">{g.target_date ? `Para el ${fmtDate(g.target_date)}` : 'Sin fecha límite'}</div>
        </div>
        <button className="btn danger sm" onClick={remove} aria-label="Eliminar meta">✕</button>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="amount">{mxn(saved)}</span><span className="muted">{mxn(target)}</span>
        </div>
        <Bar value={saved} max={target} tone="ok" />
        <div className="small muted" style={{ marginTop: 4 }}>{pct((saved / target) * 100)} completado{!done && ` · faltan ${mxn(remaining)}`}</div>
      </div>
      {hint && <div className="banner small" style={{ margin: 0, padding: '8px 12px' }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="number" min="0" step="0.01" placeholder="Monto" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <button className="btn sm" onClick={() => contribute(1)}>Aportar</button>
        <button className="btn ghost sm" onClick={() => contribute(-1)}>Retirar</button>
      </div>
    </div>
  )
}

export default function Goals() {
  const D = useData()
  const blank = { name: '', target_amount: '', target_date: '', initial_amount: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function add(e) {
    e.preventDefault(); setError('')
    if (!f.name.trim()) return setError('Ponle un nombre a la meta.')
    if (!(Number(f.target_amount) > 0)) return setError('Escribe el monto objetivo.')
    const { error } = await supabase.from('goals').insert({
      name: f.name.trim(), target_amount: Number(f.target_amount),
      target_date: f.target_date || null, initial_amount: Number(f.initial_amount) || 0,
    })
    if (error) return setError(error.message)
    setF(blank); D.reload()
  }

  return (
    <>
      <div className="page-head"><h1>Metas</h1></div>
      <form className="card stack" onSubmit={add} style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Nueva meta</h2>
        <div className="form-grid">
          <div><label>¿Qué quieres lograr?</label><input value={f.name} onChange={set('name')} placeholder="Fondo de emergencia, viaje…" /></div>
          <div><label>Monto objetivo</label><input type="number" min="0" step="0.01" value={f.target_amount} onChange={set('target_amount')} /></div>
          <div><label>Fecha objetivo</label><input type="date" value={f.target_date} onChange={set('target_date')} /></div>
          <div><label>Ya tengo ahorrado</label><input type="number" min="0" step="0.01" value={f.initial_amount} onChange={set('initial_amount')} /></div>
        </div>
        <ErrorMsg msg={error} />
        <button className="btn" style={{ alignSelf: 'flex-start' }}>Crear meta</button>
      </form>
      {D.goals.length === 0 ? <div className="card"><Empty>Aún no tienes metas. Crea la primera arriba 👆</Empty></div> : (
        <div className="grid two">{D.goals.map((g) => <GoalCard key={g.id} g={g} onChange={D.reload} />)}</div>
      )}
    </>
  )
}
