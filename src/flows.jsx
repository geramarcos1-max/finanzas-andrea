import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useData } from './lib/DataContext'
import { GROUPS, cents, propose, r2, totals } from './lib/calc'
import { fmtDate, mxn, today } from './lib/format'
import { FormModal, Group, Modal, MoneyInput, Pill, opts, run, toNum } from './ui'

// ---------- Registrar / editar un gasto (sale de una cuenta y de un sobre) ----------
export function ExpenseModal({ envId, title = 'Registrar gasto', withCategory, editing, prefill, onClose }) {
  const D = useData()
  const accounts = D.accounts.filter((a) => !a.archived)
  const fields = [
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'account_id', label: 'Pagado desde la cuenta', type: 'select', options: opts(accounts), required: true },
    ...(withCategory ? [{ key: 'category_id', label: 'Categoría', type: 'select', options: opts(D.categories.filter((c) => !c.archived && c.kind === 'expense')) }] : []),
    { key: 'note', label: 'Descripción', type: 'text', placeholder: 'Ej. Cine con Gera' },
  ]
  if (!accounts.length) {
    return <Modal title={title} onClose={onClose} footer={<button className="btn pri" onClick={onClose}>Entendido</button>}>
      <p>Primero crea una cuenta (banco o efectivo) en la sección <b>Cuentas</b>.</p>
    </Modal>
  }
  const initial = editing
    ? { date: editing.date, amount: String(editing.amount), account_id: editing.account_id, category_id: editing.category_id || '', note: editing.note || '' }
    : { date: today(), amount: '', account_id: accounts[0].id, category_id: D.categories.find((c) => c.name === 'Otro')?.id || '', note: '', ...(prefill || {}) }

  return (
    <FormModal title={editing ? 'Editar gasto' : title} fields={fields} initial={initial} onClose={onClose}
      onSave={async (v) => {
        if (envId) {
          const t = totals(D)
          const bal = (t.env[envId]?.balance ?? 0) + (editing ? Number(editing.amount) : 0)
          if (cents(v.amount) > cents(bal) && !window.confirm(`Este sobre solo tiene ${mxn(bal)} apartados. ¿Registrar el gasto de todos modos?`)) {
            return 'Ajusta el monto o asigna más dinero a este sobre primero.'
          }
        }
        const row = { date: v.date, amount: v.amount, account_id: v.account_id, category_id: v.category_id || null, envelope_id: envId || null, note: v.note || null, kind: 'expense' }
        const q = editing ? supabase.from('transactions').update(row).eq('id', editing.id) : supabase.from('transactions').insert(row)
        return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
      }} />
  )
}

// ---------- Mover dinero entre sobres (o desde "por asignar") ----------
export function MoveModal({ toEnvId, fromEnvId, onClose }) {
  const D = useData()
  const t = totals(D)
  const envs = D.envelopes.filter((e) => !e.archived)
  const fields = [
    { key: 'from', label: 'Tomar de', type: 'select', options: [{ value: 'unassigned', label: `Dinero sin asignar (${mxn(t.unassigned)})` }, ...envs.map((e) => ({ value: e.id, label: `${e.name} (${mxn(t.env[e.id]?.balance || 0)})` }))] },
    { key: 'to', label: 'Mover a', type: 'select', options: opts(envs) },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'date', label: 'Fecha', type: 'date', required: true },
  ]
  return (
    <FormModal title="Mover dinero" sub="El dinero no sale de tus cuentas; solo cambia de sobre." fields={fields} onClose={onClose}
      initial={{ from: fromEnvId || 'unassigned', to: toEnvId || envs[0]?.id, amount: '', date: today() }}
      onSave={async (v) => {
        if (v.from === v.to) return 'Elige sobres distintos.'
        const available = v.from === 'unassigned' ? t.unassigned : t.env[v.from]?.balance || 0
        if (cents(v.amount) > cents(available)) return `Solo hay ${mxn(available)} disponibles en ese origen.`
        const rows = v.from === 'unassigned'
          ? [{ date: v.date, envelope_id: v.to, amount: v.amount, kind: 'unassigned' }]
          : [{ date: v.date, envelope_id: v.from, amount: -v.amount, kind: 'move', note: 'Movido a otro sobre' },
             { date: v.date, envelope_id: v.to, amount: v.amount, kind: 'move', note: 'Recibido de otro sobre' }]
        return (await run(supabase.from('allocations').insert(rows), D.reload, 'Dinero movido')) ? true : 'No se pudo guardar'
      }} />
  )
}

// ---------- Flujo de ingreso: datos -> confirmar -> reparto ----------
export function IncomeFlow({ mode = 'income', onClose }) {
  const D = useData()
  const nav = useNavigate()
  const t = totals(D)
  const sources = D.income_sources.filter((s) => !s.archived)
  const accounts = D.accounts.filter((a) => !a.archived)
  const assign = mode === 'assign'
  const [step, setStep] = useState(1)
  const [f, setF] = useState({
    source: sources[0]?.id || '', amount: assign ? String(Math.max(0, t.unassigned)) : '', date: today(), account: accounts[0]?.id || '',
  })
  const [lines, setLines] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const amount = toNum(f.amount)

  function next() {
    if (!(amount > 0)) return setErr('Escribe el monto.')
    if (!assign && !f.account) return setErr('Primero crea una cuenta en la sección Cuentas.')
    if (assign && cents(amount) > cents(t.unassigned)) return setErr(`Solo tienes ${mxn(t.unassigned)} sin asignar.`)
    setErr('')
    if (assign) { setLines(normalizeLines(propose(D, D.settings, amount, f.date))); setStep(3) } else setStep(2)
  }

  const total = lines.reduce((a, l) => a + toNum(l.amount), 0)
  const diff = cents(amount) - cents(total)

  async function accept() {
    setBusy(true)
    const payload = lines.filter((l) => toNum(l.amount) > 0).map((l) => ({ envelope_id: l.envelope_id, amount: toNum(l.amount) }))
    const q = assign
      ? supabase.rpc('assign_unassigned', { p_date: f.date, p_lines: payload })
      : supabase.rpc('register_income', { p_date: f.date, p_source: f.source || null, p_amount: amount, p_account: f.account, p_note: null, p_lines: payload })
    const ok = await run(q, D.reload, assign ? 'Dinero asignado' : 'Ingreso repartido')
    setBusy(false)
    if (ok) onClose()
  }

  const Steps = () => <div className="steps">{[1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
  const src = D.income_sources.find((s) => s.id === f.source)?.name

  if (step === 1 && !assign && !accounts.length) {
    return (
      <Modal onClose={onClose}
        footer={<><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={() => { onClose(); nav('/cuentas') }}>Crear mi primera cuenta</button></>}>
        <h3>Primero necesitas una cuenta</h3>
        <p className="note">Un ingreso tiene que llegar a algún lado: tu cuenta de banco o tu efectivo. Créala con su saldo de hoy y regresa a registrar tu ingreso.</p>
      </Modal>
    )
  }

  if (step === 1) {
    return (
      <Modal onClose={onClose}
        footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={next}>Continuar</button></>}>
        <Steps />
        <h3>{assign ? 'Asignar dinero sin asignar' : 'Registrar ingreso'}</h3>
        <p className="note">{assign ? `Tienes ${mxn(t.unassigned)} en tus cuentas que aún no están apartados en ningún sobre.` : 'Paso 1 de 3 · ¿Qué te llegó?'}</p>
        <div className="form" style={{ padding: '12px 0' }}>
          {!assign && (
            <label className="f">Fuente
              <select value={f.source} onChange={(e) => set('source')(e.target.value)}>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="f">Monto<MoneyInput value={f.amount} onChange={set('amount')} placeholder="Ej. 30,000" /></label>
          {!assign && (
            <label className="f">Llegó a la cuenta
              <select value={f.account} onChange={(e) => set('account')(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <label className="f">Fecha<input type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} /></label>
        </div>
        {err && <p className="note bad-t">{err}</p>}
      </Modal>
    )
  }

  if (step === 2) {
    return (
      <Modal onClose={onClose}
        footer={<><button className="btn" onClick={() => setStep(1)}>Corregir</button>
          <button className="btn pri" onClick={() => { setLines(normalizeLines(propose(D, D.settings, amount, f.date))); setStep(3) }}>Sí, es correcto</button></>}>
        <Steps />
        <h3>Confirma tu ingreso</h3>
        <p className="note">Paso 2 de 3 · Revisa que coincida con lo que llegó a tu cuenta.</p>
        <div className="big num">{mxn(amount)}</div>
        <p>De <b>{src || 'sin fuente'}</b>, recibido el {fmtDate(f.date)} en <b>{D.accounts.find((a) => a.id === f.account)?.name}</b>.</p>
      </Modal>
    )
  }

  let g = ''
  return (
    <Modal onClose={onClose}
      footer={<><button className="btn" onClick={() => setLines(normalizeLines(propose(D, D.settings, amount, f.date)))}>Restaurar propuesta</button>
        <div className="row">
          {!assign && <button className="btn" onClick={() => setStep(2)}>Atrás</button>}
          <button className="btn pri" disabled={diff !== 0 || busy} onClick={accept}>Aceptar reparto</button>
        </div></>}>
      <Steps />
      <h3>Propuesta de reparto</h3>
      <p className="note">Paso 3 de 3 · Puedes editar cualquier monto antes de aceptar. El orden se cambia en Configuración.</p>
      <div style={{ margin: '8px 0' }}>
        {lines.map((l, i) => {
          const head = l.group !== g ? (g = l.group, <Group key={'g' + l.group}>{GROUPS[l.group]}</Group>) : null
          const cur = toNum(l.amount)
          return (
            <div key={l.envelope_id}>
              {head}
              <div className="propline">
                <div className="n">
                  {l.name}{' '}
                  {l.falta > 0 && cur < l.falta && <Pill tone="warn">faltan {mxn(l.falta - cur)}</Pill>}
                  {l.falta === 0 && l.group !== 'longterm' && <Pill tone="good">cubierto</Pill>}
                </div>
                <MoneyInput value={l.amount} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
              </div>
            </div>
          )
        })}
      </div>
      <div className={`callout ${diff === 0 ? 'good' : 'bad'}`}>
        Asignado {mxn(total)} de {mxn(amount)} ·{' '}
        {diff === 0 ? 'Todo el dinero está repartido.' : diff > 0 ? `Faltan ${mxn(diff / 100)} por asignar.` : `Te pasaste por ${mxn(-diff / 100)}.`}
      </div>
    </Modal>
  )
}

// Normaliza las líneas de propuesta a cadenas editables
export const normalizeLines = (ls) => ls.map((l) => ({ ...l, amount: String(r2(l.amount) || '') }))

// Elimina un sobre; si ya tiene historial lo archiva (y exige que su saldo esté en cero).
export async function removeEnvelope(D, e) {
  const bal = totals(D).env[e.id]?.balance || 0
  if (Math.abs(bal) >= 0.5) {
    window.alert(`"${e.name}" tiene ${mxn(bal)} apartados. Primero mueve ese dinero a otro sobre (botón "Mover dinero") y luego podrás quitarlo.`)
    return
  }
  const used = D.allocations.some((a) => a.envelope_id === e.id) || D.transactions.some((t) => t.envelope_id === e.id) || D.loans.some((l) => l.envelope_id === e.id)
  if (!used) {
    if (window.confirm(`¿Eliminar "${e.name}"?`)) await run(supabase.from('envelopes').delete().eq('id', e.id), D.reload, 'Eliminado')
  } else if (window.confirm(`"${e.name}" ya tiene movimientos, así que se archivará (deja de aparecer pero se conserva el historial). ¿Continuar?`)) {
    await run(supabase.from('envelopes').update({ archived: true }).eq('id', e.id), D.reload, 'Archivado')
  }
}
