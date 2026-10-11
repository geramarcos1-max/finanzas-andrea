import { useState } from 'react'
import { supabase } from './lib/supabase'
import { useData } from './lib/DataContext'
import { mxn } from './lib/format'
import { MoneyInput, toNum } from './ui'

const TYPES = [
  { value: 'bank', label: 'Cuenta de banco' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'savings', label: 'Cajita / ahorro del banco' },
  { value: 'investment', label: 'Inversión' },
]

// Se muestra una sola vez: la primera vez que se entra a la app.
export default function Setup({ email, onDone }) {
  const D = useData()
  const [step, setStep] = useState(0)
  const [rows, setRows] = useState([
    { name: 'Mi cuenta de banco', type: 'bank', balance: '' },
    { name: 'Efectivo', type: 'cash', balance: '' },
  ])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(0)

  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const total = rows.reduce((s, r) => s + toNum(r.balance), 0)

  async function save() {
    const clean = rows.filter((r) => r.name.trim() || toNum(r.balance) > 0)
    if (clean.some((r) => !r.name.trim())) return setErr('Ponle nombre a cada cuenta, por ejemplo “Santander”.')
    if (!clean.length) return setErr('Agrega al menos una cuenta.')
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('complete_setup', {
      p_accounts: clean.map((r) => ({ name: r.name.trim(), type: r.type, balance: toNum(r.balance) })),
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setSaved(clean.reduce((s, r) => s + toNum(r.balance), 0))
    setStep(2)
  }

  async function finish(goAssign) {
    await D.reload()
    onDone(goAssign)
  }

  return (
    <div className="auth">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="steps">{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>

        {step === 0 && (
          <>
            <h3 style={{ fontSize: 24 }}>¡Hola, Andrea! 👋</h3>
            <p>Esta app te ayuda a saber <b>cuánto puedes gastar</b>, qué tienes que pagar y cómo ir ahorrando, sin complicarte.</p>
            <p>Antes de empezar necesito saber <b>cuánto dinero tienes hoy</b>. Solo lo harás <b>esta vez</b> y toma un minuto.</p>
            <div className="foot">
              <button className="link" onClick={() => supabase.auth.signOut()}>No soy yo ({email})</button>
              <button className="btn pri big-action" onClick={() => setStep(1)}>Empezar</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>¿Dónde tienes tu dinero hoy?</h3>
            <p className="note">Escribe cada cuenta con lo que tiene ahorita. Revisa tu app del banco. Si tienes cajitas o apartados en el banco, agrégalos como otra cuenta.</p>
            <div className="stack" style={{ margin: '14px 0' }}>
              {rows.map((r, i) => (
                <div key={i} className="card" style={{ padding: 12 }}>
                  <div className="form">
                    <label className="f">Nombre<input value={r.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Ej. Santander" /></label>
                    <label className="f">Tipo
                      <select value={r.type} onChange={(e) => set(i, 'type', e.target.value)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                    </label>
                    <label className="f">¿Cuánto tiene hoy?<MoneyInput value={r.balance} onChange={(v) => set(i, 'balance', v)} placeholder="$ 0" /></label>
                  </div>
                  {rows.length > 1 && <button className="link" style={{ marginTop: 8 }} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Quitar esta cuenta</button>}
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => setRows((rs) => [...rs, { name: '', type: 'bank', balance: '' }])}>+ Agregar otra cuenta</button>
            <div className="callout" style={{ marginTop: 14 }}>Tienes en total <b>{mxn(total)}</b></div>
            {err && <p className="note bad-t" role="alert">{err}</p>}
            <div className="foot">
              <button className="btn" onClick={() => setStep(0)}>Atrás</button>
              <button className="btn pri big-action" disabled={busy} onClick={save}>Guardar y continuar</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ fontSize: 22 }}>¡Listo! 🎉</h3>
            <p>Tienes en total <b>{mxn(saved)}</b>.</p>
            {saved > 0
              ? <p>Ahora te ayudo a <b>darle un destino</b> a ese dinero: cuánto para tus pagos, cuánto para gastar y cuánto para ahorrar.</p>
              : <p>Cuando te llegue dinero, toca <b>“Me llegó dinero”</b> y yo te digo cómo repartirlo.</p>}
            <div className="foot">
              <span />
              <button className="btn pri big-action" onClick={() => finish(saved > 0)}>{saved > 0 ? 'Darle destino a mi dinero' : 'Ir al inicio'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
