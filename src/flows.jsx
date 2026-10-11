import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useData } from './lib/DataContext'
import { allocatedIn, cents, envelopeStats, loanRoom, neededFor, paymentsOf, r2, totals } from './lib/calc'
import { catEmoji, dueText } from './lib/friendly'
import { fmtDate, mxn, mxn0, today } from './lib/format'
import { FormModal, Modal, MoneyInput, opts, run, toNum, toast } from './ui'

const HOLDS = ['personal', 'goal', 'savings', 'investment']

// ---------- Registrar / editar un gasto (sale de una cuenta y, opcionalmente, de un apartado) ----------
export function ExpenseModal({ envId, title = 'Registrar gasto', withCategory, editing, prefill, noCheck, onClose }) {
  const D = useData()
  const accounts = D.accounts.filter((a) => !a.archived)
  const fields = [
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'account_id', label: 'Pagado desde la cuenta', type: 'select', options: opts(accounts), required: true },
    ...(withCategory ? [{ key: 'category_id', label: 'Categoría', type: 'select', options: opts(D.categories.filter((c) => !c.archived && c.kind === 'expense')) }] : []),
    { key: 'note', label: 'Descripción', type: 'text', placeholder: 'Ej. Cine con Gera' },
  ]
  if (!accounts.length) return <NeedAccount title={title} onClose={onClose} />
  const initial = editing
    ? { date: editing.date, amount: String(editing.amount), account_id: editing.account_id, category_id: editing.category_id || '', note: editing.note || '' }
    : { date: today(), amount: '', account_id: accounts[0].id, category_id: D.categories.find((c) => c.name === 'Otro')?.id || '', note: '', ...(prefill || {}) }

  return (
    <FormModal title={editing ? 'Editar gasto' : title} fields={fields} initial={initial} onClose={onClose}
      onSave={async (v) => {
        if (envId && !noCheck) {
          const t = totals(D)
          const bal = (t.env[envId]?.balance ?? 0) + (editing ? Number(editing.amount) : 0)
          if (cents(v.amount) > cents(bal) && !window.confirm(`Aquí solo te quedan ${mxn(bal)}. ¿Registrar el gasto de todos modos?`)) {
            return 'Ajusta el monto o primero aparta más dinero aquí.'
          }
        }
        const row = { date: v.date, amount: v.amount, account_id: v.account_id, category_id: v.category_id || null, envelope_id: envId || null, note: v.note || null, kind: 'expense' }
        const q = editing ? supabase.from('transactions').update(row).eq('id', editing.id) : supabase.from('transactions').insert(row)
        return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
      }} />
  )
}

function NeedAccount({ title, onClose }) {
  const nav = useNavigate()
  return (
    <Modal title={title || 'Primero crea una cuenta'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Ahora no</button>
        <button className="btn pri" onClick={() => { onClose(); nav('/cuentas') }}>Crear mi primera cuenta</button></>}>
      <p className="note">Necesito saber dónde tienes tu dinero: tu cuenta de banco o tu efectivo. Créala con lo que tienes hoy y regresa.</p>
    </Modal>
  )
}

// ---------- Agregar / editar un pago recurrente (el mismo formulario se usa en "Mis pagos" y al registrar dinero) ----------
export function PaymentFormModal({ editing, onClose, onSaved }) {
  const D = useData()
  const fields = [
    { key: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'fixed', label: 'Pago fijo (renta, servicios, suscripción…)' }, { value: 'debt', label: 'Deuda con saldo (carro, préstamo…)' }] },
    { key: 'name', label: '¿Qué pagas?', type: 'text', required: true, placeholder: 'Ej. Renta' },
    { key: 'monthly_amount', label: 'Monto al mes', type: 'money', required: true },
    { key: 'due_day', label: 'Día del mes en que se paga (1-31)', type: 'number', min: 1, max: 31, placeholder: 'Opcional' },
    { key: 'debt_total', label: 'Monto total de la deuda', type: 'money', show: (v) => v.kind === 'debt', placeholder: 'Opcional' },
    { key: 'debt_paid_before', label: 'Ya pagado antes de usar la app', type: 'money', show: (v) => v.kind === 'debt', placeholder: '0' },
  ]
  const initial = editing
    ? { kind: editing.kind, name: editing.name, monthly_amount: String(editing.monthly_amount || ''), due_day: editing.due_day || '',
        debt_total: editing.debt_total ? String(editing.debt_total) : '', debt_paid_before: editing.debt_paid_before ? String(editing.debt_paid_before) : '' }
    : { kind: 'fixed' }

  async function save(v) {
    const row = {
      kind: v.kind, name: v.name.trim(), monthly_amount: v.monthly_amount, due_day: v.due_day ? Number(v.due_day) : null,
      debt_total: v.kind === 'debt' && v.debt_total > 0 ? v.debt_total : null, debt_paid_before: v.kind === 'debt' ? v.debt_paid_before || 0 : 0,
    }
    const { data, error } = editing
      ? await supabase.from('envelopes').update(row).eq('id', editing.id)
      : await supabase.from('envelopes').insert(row).select('id').single()
    if (error) return error.message
    await D.reload()
    toast('Pago guardado en Mis pagos ✓')
    onSaved?.(data?.id || editing?.id, row)
    return true
  }

  return (
    <FormModal title={editing ? 'Editar pago' : 'Nuevo pago'} sub={editing ? null : 'Se guarda en Mis pagos y se repite cada mes.'}
      fields={fields} initial={initial} onSave={save} onClose={onClose} />
  )
}

// ---------- Crear / editar una meta (se usa en "Mis metas" y al repartir lo que sobra) ----------
export function GoalFormModal({ editing, onClose, onSaved }) {
  const D = useData()
  const fields = [
    { key: 'name', label: '¿Qué quieres lograr?', type: 'text', required: true, placeholder: 'Ej. Viaje a Oaxaca, Colchón…' },
    { key: 'target_amount', label: 'Monto de la meta', type: 'money', required: true },
    { key: 'target_date', label: 'Fecha límite (opcional)', type: 'date' },
    { key: 'monthly_amount', label: 'Apartado mensual fijo (solo si no hay fecha)', type: 'money', placeholder: 'Opcional' },
    { key: 'account_id', label: '¿Dónde guardas este dinero?', type: 'select', options: [{ value: '', label: 'En la cuenta donde me llega' }, ...opts(D.accounts.filter((a) => !a.archived))] },
  ]
  const initial = editing
    ? { name: editing.name, target_amount: String(editing.target_amount || ''), target_date: editing.target_date || '', monthly_amount: editing.monthly_amount ? String(editing.monthly_amount) : '', account_id: editing.account_id || '' }
    : { account_id: '' }

  async function save(v) {
    const row = { kind: 'goal', name: v.name.trim(), target_amount: v.target_amount, target_date: v.target_date || null, monthly_amount: v.monthly_amount || 0, account_id: v.account_id || null }
    const { data, error } = editing
      ? await supabase.from('envelopes').update(row).eq('id', editing.id)
      : await supabase.from('envelopes').insert(row).select('id').single()
    if (error) return error.message
    await D.reload()
    toast('Meta guardada ✓')
    onSaved?.(data?.id || editing?.id)
    return true
  }

  return (
    <FormModal title={editing ? 'Editar meta' : 'Nueva meta'}
      sub={editing ? null : 'Una meta es algo que quieres lograr, con su monto. Yo te digo cuánto abonar cada mes.'}
      fields={fields} initial={initial} onSave={save} onClose={onClose} />
  )
}

// ---------- "Gasté algo": lo más rápido posible ----------
export function QuickExpense({ onClose }) {
  const D = useData()
  const T = totals(D)
  const accounts = D.accounts.filter((a) => !a.archived)
  const personal = D.envelopes.find((e) => e.kind === 'personal')
  const cats = D.categories.filter((c) => !c.archived && c.kind === 'expense')
  const [f, setF] = useState({ amount: '', cat: cats.find((c) => c.name === 'Otro')?.id || cats[0]?.id || '', note: '', account: accounts[0]?.id || '', date: today() })
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!accounts.length) return <NeedAccount onClose={onClose} />
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const amount = toNum(f.amount)
  const left = personal ? T.env[personal.id]?.balance || 0 : 0

  async function save() {
    if (!(amount > 0)) return setErr('Escribe cuánto gastaste.')
    if (personal && cents(amount) > cents(left) && !window.confirm(`Solo te quedan ${mxn(left)} para gastar. ¿Lo registro de todos modos?`)) return
    setBusy(true); setErr('')
    const ok = await run(supabase.from('transactions').insert({
      kind: 'expense', date: f.date, amount, account_id: f.account, category_id: f.cat || null,
      envelope_id: personal?.id || null, note: f.note || null,
    }), D.reload)
    setBusy(false)
    if (ok) { toast(`Listo ✓ Te quedan ${mxn(Math.max(0, r2(left - amount)))} para gastar`); onClose() }
  }

  return (
    <Modal title="¿Qué gastaste?" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri big-action" disabled={busy} onClick={save}>Guardar gasto</button></>}>
      <label className="f" style={{ marginTop: 10 }}>¿Cuánto?
        <MoneyInput className="amount-input" autoFocus value={f.amount} onChange={set('amount')} placeholder="$ 0" />
      </label>
      <div className="f" style={{ marginTop: 14 }}>¿En qué?</div>
      <div className="catgrid">
        {cats.map((c) => (
          <button key={c.id} type="button" className={`catbtn ${f.cat === c.id ? 'on' : ''}`} onClick={() => set('cat')(c.id)}>
            <span>{catEmoji(c.name)}</span>{c.name}
          </button>
        ))}
      </div>
      <label className="f" style={{ marginTop: 14 }}>Nota (opcional)
        <input value={f.note} onChange={(e) => set('note')(e.target.value)} placeholder="Ej. Cine con Gera" />
      </label>
      {more ? (
        <div className="form" style={{ marginTop: 12 }}>
          <label className="f">Pagaste con
            <select value={f.account} onChange={(e) => set('account')(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </label>
          <label className="f">Fecha<input type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} /></label>
        </div>
      ) : (
        <p className="note" style={{ marginTop: 10 }}>
          Se descuenta de <b>{accounts.find((a) => a.id === f.account)?.name}</b> · {f.date === today() ? 'hoy' : fmtDate(f.date)}{' '}
          <button className="link edit" onClick={() => setMore(true)}>Cambiar</button>
        </p>
      )}
      {personal && <p className="note">Después de este gasto te quedarán <b>{mxn(Math.max(0, r2(left - amount)))}</b> para gastar.</p>}
      {err && <p className="note bad-t" role="alert">{err}</p>}
    </Modal>
  )
}

// ---------- Mover dinero entre apartados (o desde "dinero sin destino") ----------
export function MoveModal({ toEnvId, fromEnvId, onClose }) {
  const D = useData()
  const t = totals(D)
  const envs = D.envelopes.filter((e) => !e.archived && HOLDS.includes(e.kind))
  const fields = [
    { key: 'from', label: 'Tomar de', type: 'select', options: [{ value: 'unassigned', label: `Dinero sin destino (${mxn(t.unassigned)})` }, ...envs.map((e) => ({ value: e.id, label: `${e.name} (${mxn(t.env[e.id]?.balance || 0)})` }))] },
    { key: 'to', label: 'Pasar a', type: 'select', options: opts(envs) },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'date', label: 'Fecha', type: 'date', required: true },
  ]
  return (
    <FormModal title="Mover dinero" sub="Tu dinero no sale del banco; solo cambia de destino dentro de la app." fields={fields} onClose={onClose}
      initial={{ from: fromEnvId || 'unassigned', to: toEnvId || envs[0]?.id, amount: '', date: today() }}
      onSave={async (v) => {
        if (v.from === v.to) return 'Elige destinos distintos.'
        const available = v.from === 'unassigned' ? t.unassigned : t.env[v.from]?.balance || 0
        if (cents(v.amount) > cents(available)) return `Solo hay ${mxn(available)} disponibles ahí.`
        const rows = v.from === 'unassigned'
          ? [{ date: v.date, envelope_id: v.to, amount: v.amount, kind: 'unassigned' }]
          : [{ date: v.date, envelope_id: v.from, amount: -v.amount, kind: 'move', note: 'Movido a otro destino' },
             { date: v.date, envelope_id: v.to, amount: v.amount, kind: 'move', note: 'Recibido de otro destino' }]
        return (await run(supabase.from('allocations').insert(rows), D.reload, 'Dinero movido')) ? true : 'No se pudo guardar'
      }} />
  )
}

// ---------- Guardaditos pendientes en el banco ----------
export function BankSteps({ moves }) {
  const D = useData()
  const name = (id) => D.accounts.find((a) => a.id === id)?.name || '—'
  const groups = {}
  moves.forEach((m) => {
    const k = `${m.from_account_id}>${m.to_account_id}`
    const g = (groups[k] ||= { from: m.from_account_id, to: m.to_account_id, ids: [], items: [], total: 0 })
    g.ids.push(m.id); g.items.push(m); g.total += Number(m.amount)
  })
  const done = (g) => run(supabase.rpc('complete_moves', { p_ids: g.ids }), D.reload, 'Guardadito registrado ✓')
  const skip = async (g) => {
    if (window.confirm('¿No lo vas a hacer? Se quitará de la lista (tu dinero seguirá apartado en la app).'))
      await run(supabase.from('pending_moves').delete().in('id', g.ids), D.reload)
  }
  return Object.values(groups).map((g) => (
    <div className="card bank" key={g.from + g.to}>
      <div className="note">En tu banco, pasa</div>
      <div className="big num" style={{ margin: '2px 0' }}>{mxn(g.total)}</div>
      <div>de <b>{name(g.from)}</b> a <b>{name(g.to)}</b></div>
      <div className="note" style={{ marginTop: 6 }}>
        Incluye: {g.items.map((m) => `${D.envelopes.find((e) => e.id === m.envelope_id)?.name || '—'} ${mxn0(m.amount)}`).join(' · ')}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn pri" onClick={() => done(g)}>Ya lo hice ✓</button>
        <button className="link" onClick={() => skip(g)}>No lo haré</button>
      </div>
    </div>
  ))
}

export function BankStepsModal({ onClose }) {
  const D = useData()
  const moves = D.pending_moves.filter((m) => !m.done_at)
  return (
    <Modal title="Tus guardaditos en el banco" sub="Haz estos movimientos en la app de tu banco y luego márcalos aquí." onClose={onClose}
      footer={<button className="btn pri" onClick={onClose}>Cerrar</button>}>
      {moves.length === 0 ? <p>🎉 No tienes guardaditos pendientes.</p> : <BankSteps moves={moves} />}
    </Modal>
  )
}

// ---------- Me llegó dinero: datos -> pagos -> gastos personales -> ahorro/inversión -> resumen ----------
function PickRow({ checked, onToggle, title, sub, amount, onAmount }) {
  return (
    <div className={`pickrow ${checked ? 'on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={title} />
      <div className="n" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <b>{title}</b>
        {sub && <div className="note">{sub}</div>}
      </div>
      <MoneyInput value={amount} onChange={onAmount} placeholder="$ 0" />
    </div>
  )
}

export function IncomeFlow({ mode = 'income', onClose }) {
  const D = useData()
  const nav = useNavigate()
  const t = totals(D)
  const assign = mode === 'assign'
  const sources = D.income_sources.filter((s) => !s.archived)
  const accounts = D.accounts.filter((a) => !a.archived)
  const [step, setStep] = useState('form')
  const [f, setF] = useState({
    source: sources[0]?.id || '', amount: assign ? String(Math.max(0, t.unassigned)) : '', date: today(), account: accounts[0]?.id || '',
  })
  const [dateOpen, setDateOpen] = useState(false)
  const [picked, setPicked] = useState({})
  const [personal, setPersonal] = useState('')
  const [sav, setSav] = useState('')
  const [inv, setInv] = useState('')
  const [goalAdd, setGoalAdd] = useState({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [incomeId, setIncomeId] = useState(null)
  const [addPay, setAddPay] = useState(false)
  const [addGoal, setAddGoal] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const amount = toNum(f.amount)
  const month = f.date.slice(0, 7)
  const accName = accounts.find((a) => a.id === f.account)?.name

  // Lo que se puede elegir pagar / abonar este mes
  const now = envelopeStats(D)
  const before = envelopeStats(D, month + '-01')
  const pays = paymentsOf(D, month).filter((p) => !p.done)
  const goals = D.envelopes.filter((e) => !e.archived && e.kind === 'goal').map((e) => {
    const target = Number(e.target_amount) || 0
    const bal = now[e.id]?.balance || 0
    const need = target && bal >= target ? 0 : Math.max(0, neededFor(e, D, month, now, before) - allocatedIn(D, e.id, month))
    return { e, need }
  })
  const people = D.people.filter((p) => !p.archived).map((p) => {
    const { room } = loanRoom(D, p.id, month, D.settings.loan_limit)
    return { p, room, need: Math.min(Number(p.monthly_amount) || 0, room) }
  })

  const items = [
    ...pays.map((x) => ({ key: 'pay:' + x.e.id, group: 'pay', id: x.e.id, title: x.e.name, sub: `${x.e.due_day ? dueText(x.e.due_day) + ' · ' : ''}${x.e.kind === 'debt' ? 'Deuda' : 'Pago fijo'}`, need: x.remaining })),
    ...goals.map((x) => ({ key: 'goal:' + x.e.id, group: 'goal', id: x.e.id, title: x.e.name, sub: x.need > 0 ? 'Abono sugerido para tu meta' : 'Meta', need: x.need })),
    ...people.map((x) => ({ key: 'loan:' + x.p.id, group: 'loan', id: x.p.id, title: `Préstamo a ${x.p.name}`, sub: `Puedes prestar hasta ${mxn0(x.room)} este mes`, need: x.need, room: x.room })),
  ]
  const val = (it) => picked[it.key] ?? { on: false, amount: it.need > 0 ? String(it.need) : '' }
  const setPick = (it, patch) => setPicked((p) => ({ ...p, [it.key]: { ...val(it), ...patch } }))
  const chosen = items.filter((it) => val(it).on && toNum(val(it).amount) > 0)
  const chosenTotal = r2(chosen.reduce((s, it) => s + toNum(val(it).amount), 0))
  const left = r2(amount - chosenTotal)
  const persN = toNum(personal)
  const rest = r2(left - persN)
  const savN = toNum(sav)
  const invN = toNum(inv)
  const goalAddN = (gid) => toNum(goalAdd[gid])
  const goalAddTotal = r2(Object.keys(goalAdd).reduce((s, gid) => s + goalAddN(gid), 0))
  const destTotal = r2(savN + invN + goalAddTotal)
  const toPlace = r2(rest - destTotal)

  // Metas disponibles para abonar con lo que sobra (se descuenta lo ya elegido en el paso 2)
  const goalsLeft = goals.map((x) => {
    const already = toNum(picked['goal:' + x.e.id]?.on ? picked['goal:' + x.e.id].amount : 0)
    return { ...x, suggest: Math.max(0, r2(x.need - already)) }
  })
  // Total por meta = lo elegido en el paso 2 + lo que se agrega con lo que sobra
  const goalTotals = {}
  chosen.filter((it) => it.group === 'goal').forEach((it) => { goalTotals[it.id] = r2((goalTotals[it.id] || 0) + toNum(val(it).amount)) })
  Object.keys(goalAdd).forEach((gid) => { if (goalAddN(gid) > 0) goalTotals[gid] = r2((goalTotals[gid] || 0) + goalAddN(gid)) })

  if (step === 'form' && !accounts.length) {
    return (
      <Modal onClose={onClose} title="Primero necesitas una cuenta"
        footer={<><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={() => { onClose(); nav('/cuentas') }}>Crear mi primera cuenta</button></>}>
        <p className="note">Un ingreso tiene que llegar a algún lado: tu cuenta de banco o tu efectivo. Créala con su saldo de hoy y regresa a registrar tu dinero.</p>
      </Modal>
    )
  }

  const Dots = ({ n }) => <div className="steps">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? 'on' : ''} />)}</div>

  function toPagos() {
    if (!(amount > 0)) return setErr('Escribe cuánto te llegó.')
    if (assign && cents(amount) > cents(t.unassigned)) return setErr(`Solo tienes ${mxn(t.unassigned)} sin destino.`)
    setErr(''); setStep('pagos')
  }

  function afterPagos() {
    if (cents(chosenTotal) > cents(amount)) return setErr(`Elegiste ${mxn(chosenTotal)}, que es más de lo que te llegó (${mxn(amount)}).`)
    const bad = chosen.find((it) => it.group === 'loan' && cents(toNum(val(it).amount)) > cents(it.room))
    if (bad) return setErr(`${bad.title}: solo puedes prestar ${mxn(bad.room)} este mes.`)
    setErr('')
    if (left <= 0) { setPersonal(''); setSav(''); setInv(''); setGoalAdd({}); return setStep('resumen') }
    setStep('personal')
  }

  function afterPersonal() {
    if (cents(persN) > cents(left)) return setErr(`Solo te quedan ${mxn(left)}.`)
    setErr('')
    if (rest <= 0) { setSav(''); setInv(''); setGoalAdd({}); return setStep('resumen') }
    setSav(String(rest)); setInv(''); setGoalAdd({}); setStep('ahorro')
  }

  // Atajos de la pantalla "lo que sobra"
  const putAll = (s, i, g = {}) => { setSav(s ? String(s) : ''); setInv(i ? String(i) : ''); setGoalAdd(g) }
  function useSuggested() {
    let room = rest
    const g = {}
    goalsLeft.forEach((x) => { const v = Math.min(room, x.suggest); if (v > 0) { g[x.e.id] = String(v); room = r2(room - v) } })
    putAll(room, 0, g)
  }

  async function confirm() {
    setBusy(true)
    const pick = (g) => chosen.filter((it) => it.group === g)
    const { data, error } = await supabase.rpc('register_flow', {
      p_mode: mode, p_date: f.date, p_source: assign ? null : f.source || null, p_amount: amount, p_account: f.account,
      p_payments: pick('pay').map((it) => ({ envelope_id: it.id, amount: toNum(val(it).amount) })),
      p_goals: Object.entries(goalTotals).filter(([, v]) => v > 0).map(([gid, v]) => ({ envelope_id: gid, amount: v })),
      p_loans: pick('loan').map((it) => ({ person_id: it.id, amount: toNum(val(it).amount) })),
      p_personal: persN, p_savings: rest > 0 ? savN : 0, p_investment: rest > 0 ? invN : 0,
    })
    if (error) { setBusy(false); return toast('⚠️ ' + error.message) }
    await D.reload()
    setBusy(false)
    setIncomeId(data); setStep('done')
  }

  // ----- 1. ¿Cuánto te llegó? -----
  if (step === 'form') {
    return (
      <Modal onClose={onClose} title={assign ? 'Dale destino a tu dinero' : '¿Cuánto te llegó?'}
        sub={assign ? `Tienes ${mxn(t.unassigned)} en tus cuentas que todavía no tienen destino.` : null}
        footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri big-action" onClick={toPagos}>Continuar</button></>}>
        <Dots n={1} />
        <label className="f" style={{ marginTop: 6 }}>Monto
          <MoneyInput className="amount-input" autoFocus value={f.amount} onChange={set('amount')} placeholder="$ 0" />
        </label>
        {!assign && sources.length > 0 && (
          <>
            <div className="f" style={{ marginTop: 14 }}>¿De quién?</div>
            <div className="chips">
              {sources.map((s) => <button key={s.id} type="button" className={`chipbtn ${f.source === s.id ? 'on' : ''}`} onClick={() => set('source')(s.id)}>{s.name}</button>)}
            </div>
          </>
        )}
        {accounts.length > 1 ? (
          <label className="f" style={{ marginTop: 14 }}>{assign ? '¿Desde qué cuenta pagarás?' : '¿A qué cuenta llegó?'}
            <select value={f.account} onChange={(e) => set('account')(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </label>
        ) : <p className="note" style={{ marginTop: 12 }}>{assign ? 'Cuenta' : 'Llegó a'} <b>{accName}</b></p>}
        <p className="note" style={{ marginTop: 10 }}>
          {f.date === today() ? 'Fecha: hoy' : `Fecha: ${fmtDate(f.date)}`}{' '}
          <button className="link edit" onClick={() => setDateOpen(!dateOpen)}>Cambiar</button>
        </p>
        {dateOpen && <input type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />}
        {err && <p className="note bad-t" role="alert">{err}</p>}
      </Modal>
    )
  }

  // ----- 2. ¿Qué pagos tienes que hacer? -----
  if (step === 'pagos') {
    const groupTitle = { pay: 'Pagos del mes', goal: 'Abonos a tus metas', loan: 'Préstamo familiar' }
    let g = ''
    return (
      <Modal onClose={onClose} title="¿Qué pagos tienes que hacer?"
        sub="Marca los que vas a pagar con este dinero. Los que marques se registran como pagados."
        footer={<><button className="btn" onClick={() => { setErr(''); setStep('form') }}>Atrás</button><button className="btn pri big-action" onClick={afterPagos}>Continuar</button></>}>
        <Dots n={2} />
        {items.length === 0 ? <p className="note">Aún no tienes pagos pendientes este mes. Si tienes alguno (renta, carro, celular…), agrégalo aquí y quedará guardado en <b>Mis pagos</b>.</p> : (
          <>
            {pays.length > 0 && (
              <p style={{ margin: '4px 0' }}><button className="link edit" onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(items.filter((i) => i.group === 'pay').map((i) => [i.key, { on: true, amount: String(i.need) }])) }))}>Seleccionar todos los pagos</button></p>
            )}
            {items.map((it) => {
              const head = it.group !== g ? (g = it.group, <div className="grp" key={'g' + it.group}>{groupTitle[it.group]}</div>) : null
              const v = val(it)
              return (
                <div key={it.key}>
                  {head}
                  <PickRow checked={v.on} onToggle={() => setPick(it, { on: !v.on })} title={it.title} sub={it.sub} amount={v.amount} onAmount={(a) => setPick(it, { amount: a, on: toNum(a) > 0 ? true : v.on })} />
                </div>
              )
            })}
          </>
        )}
        <p style={{ margin: '10px 0 0' }}><button type="button" className="btn" onClick={() => setAddPay(true)}>+ Agregar un pago</button></p>
        <div className="callout" style={{ marginTop: 12 }}>
          Pagarás <b>{mxn(chosenTotal)}</b> · Te quedan <b className={left < 0 ? 'bad-t' : ''}>{mxn(left)}</b>
        </div>
        {err && <p className="note bad-t" role="alert">{err}</p>}
        {addPay && <PaymentFormModal onClose={() => setAddPay(false)}
          onSaved={(newId, row) => newId && setPicked((p) => ({ ...p, ['pay:' + newId]: { on: true, amount: String(row.monthly_amount) } }))} />}
      </Modal>
    )
  }

  // ----- 3. Gastos personales -----
  if (step === 'personal') {
    const chips = [500, 1000, 2000, 3000, 5000].filter((c) => c <= left)
    return (
      <Modal onClose={onClose} title="¿Cuánto quieres para tus gastos personales?"
        sub={`Te quedan ${mxn(left)}. Escribe cuánto quieres tener para gastar este mes (café, salidas, compras…).`}
        footer={<><button className="btn" onClick={() => { setErr(''); setStep('pagos') }}>Atrás</button><button className="btn pri big-action" onClick={afterPersonal}>Continuar</button></>}>
        <Dots n={3} />
        <label className="f" style={{ marginTop: 6 }}>Para gastar
          <MoneyInput className="amount-input" autoFocus value={personal} onChange={setPersonal} placeholder="$ 0" />
        </label>
        <div className="chips">
          {chips.map((c) => <button key={c} type="button" className={`chipbtn ${persN === c ? 'on' : ''}`} onClick={() => setPersonal(String(c))}>{mxn0(c)}</button>)}
          <button type="button" className={`chipbtn ${persN === 0 && personal !== '' ? 'on' : ''}`} onClick={() => setPersonal('0')}>Nada por ahora</button>
        </div>
        <div className="callout" style={{ marginTop: 14 }}>
          {persN > left ? <span className="bad-t">Es más de lo que te queda.</span> : <>Después de esto te sobran <b>{mxn(Math.max(0, rest))}</b> para ahorrar o invertir.</>}
        </div>
        {err && <p className="note bad-t" role="alert">{err}</p>}
      </Modal>
    )
  }

  // ----- 4. Ahorro e inversión -----
  if (step === 'ahorro') {
    return (
      <Modal onClose={onClose} title="Lo que sobra: ¿ahorro, inversión o metas?"
        sub={`Te sobran ${mxn(rest)}. Decide cuánto guardas, cuánto inviertes y cuánto abonas a tus metas.`}
        footer={<><button className="btn" onClick={() => setStep('personal')}>Atrás</button><button className="btn pri big-action" disabled={cents(destTotal) !== cents(rest)} onClick={() => setStep('resumen')}>Continuar</button></>}>
        <Dots n={4} />
        <div className="chips" style={{ marginBottom: 10 }}>
          <button type="button" className="chipbtn" onClick={() => putAll(rest, 0)}>Todo a ahorro</button>
          <button type="button" className="chipbtn" onClick={() => putAll(r2(rest / 2), r2(rest - r2(rest / 2)))}>Mitad y mitad</button>
          <button type="button" className="chipbtn" onClick={() => putAll(0, rest)}>Todo a inversión</button>
          {goalsLeft.some((x) => x.suggest > 0) && <button type="button" className="chipbtn" onClick={useSuggested}>Lo sugerido a mis metas</button>}
        </div>
        <div className="form">
          <label className="f">🌱 Ahorro
            <MoneyInput value={sav} onChange={setSav} placeholder="$ 0" />
          </label>
          <label className="f">📈 Inversión
            <MoneyInput value={inv} onChange={setInv} placeholder="$ 0" />
          </label>
        </div>
        {goalsLeft.length === 0 && (
          <div className="card" style={{ marginTop: 14, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <b>🎯 ¿Tienes algo que quieres lograr?</b>
            <p className="note" style={{ margin: '4px 0 10px' }}>Un viaje, una compra, un colchón para imprevistos… Crea una meta y abónale aquí mismo.</p>
            <button type="button" className="btn pri" onClick={() => setAddGoal(true)}>+ Crear una meta</button>
          </div>
        )}
        {goalsLeft.length > 0 && (
          <>
            <div className="grp" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Abonar a mis metas</span>
              <button type="button" className="link edit" onClick={() => setAddGoal(true)}>+ Nueva meta</button>
            </div>
            <div className="form" style={{ marginTop: 8 }}>
              {goalsLeft.map((x) => (
                <label className="f" key={x.e.id}>🎯 {x.e.name}
                  <MoneyInput value={goalAdd[x.e.id] || ''} onChange={(v) => setGoalAdd((g) => ({ ...g, [x.e.id]: v }))} placeholder={x.suggest > 0 ? `Sugerido ${mxn0(x.suggest)}` : '$ 0'} />
                </label>
              ))}
            </div>
          </>
        )}
        <div className={`callout ${toPlace === 0 ? 'good' : toPlace > 0 ? 'warn' : 'bad'}`} style={{ marginTop: 14 }}>
          {toPlace === 0 ? `✅ Repartiste todo: ${mxn(rest)}` : toPlace > 0 ? `Te faltan ${mxn(toPlace)} por repartir (de ${mxn(rest)}).` : `Te pasaste por ${mxn(-toPlace)}.`}
        </div>
        {addGoal && <GoalFormModal onClose={() => setAddGoal(false)} />}
      </Modal>
    )
  }

  // ----- 5. Resumen -----
  if (step === 'resumen') {
    const L = ({ label, v, tone }) => <div className="propline"><div className="n">{label}</div><b className={`num ${tone || ''}`}>{mxn(v)}</b></div>
    const payItems = chosen.filter((i) => i.group === 'pay'), loanItems = chosen.filter((i) => i.group === 'loan')
    const goalLines = Object.entries(goalTotals).filter(([, v]) => v > 0).map(([gid, v]) => ({ gid, v, name: D.envelopes.find((e) => e.id === gid)?.name || 'Meta' }))
    return (
      <Modal onClose={onClose} title="Revisa y confirma"
        sub={`De tus ${mxn(amount)}${assign ? '' : ` que llegaron a ${accName}`}, esto es lo que va a pasar:`}
        footer={<><button className="btn" onClick={() => setStep(left <= 0 ? 'pagos' : rest > 0 ? 'ahorro' : 'personal')}>Atrás</button>
          <button className="btn pri big-action" disabled={busy} onClick={confirm}>Confirmar</button></>}>
        <Dots n={5} />
        {payItems.length > 0 && <><div className="grp">Pagos que se marcan como pagados</div>{payItems.map((i) => <L key={i.key} label={i.title} v={toNum(val(i).amount)} />)}</>}
        {goalLines.length > 0 && <><div className="grp">Abonos a metas</div>{goalLines.map((g) => <L key={g.gid} label={`🎯 ${g.name}`} v={g.v} />)}</>}
        {loanItems.length > 0 && <><div className="grp">Préstamo familiar</div>{loanItems.map((i) => <L key={i.key} label={i.title} v={toNum(val(i).amount)} />)}</>}
        <div className="grp">Para ti</div>
        <L label="🛍️ Para gastar este mes" v={persN} />
        {rest > 0 && savN > 0 && <L label="🌱 Ahorro" v={savN} />}
        {rest > 0 && invN > 0 && <L label="📈 Inversión" v={invN} />}
        <div className="callout good" style={{ marginTop: 12 }}>✅ Todo tu dinero tiene destino.</div>
      </Modal>
    )
  }

  // ----- 6. Listo + guardaditos -----
  const moves = D.pending_moves.filter((m) => m.income_id === incomeId && !m.done_at)
  return (
    <Modal onClose={onClose} title="✅ ¡Listo!"
      sub={moves.length ? 'Ahora haz estos guardaditos en la app de tu banco:' : (assign ? 'Tu dinero ya tiene destino.' : 'Tu ingreso quedó registrado y repartido.')}
      footer={<button className="btn pri big-action" onClick={onClose}>{moves.length ? 'Los haré después' : 'Cerrar'}</button>}>
      {moves.length > 0 && <BankSteps moves={moves} />}
      {moves.length > 0 && <p className="note">Si te sales, estos pasos te esperan en la pantalla de Inicio.</p>}
    </Modal>
  )
}

// ---------- Menú del botón "+" ----------
export function AddMenu({ ctx, onClose }) {
  const nav = useNavigate()
  const go = (fn) => () => { onClose(); fn() }
  return (
    <Modal title="¿Qué quieres hacer?" onClose={onClose}>
      <div className="stack">
        <button className="bigbtn" onClick={go(ctx.openIncome)}><span>💰</span><div><b>Me llegó dinero</b><div className="note">Sueldo u otro ingreso</div></div></button>
        <button className="bigbtn" onClick={go(ctx.openExpense)}><span>🧾</span><div><b>Gasté algo</b><div className="note">Café, comida, compras…</div></div></button>
        <button className="bigbtn" onClick={() => { onClose(); nav('/pagos') }}><span>✅</span><div><b>Pagué algo de mis pagos</b><div className="note">Renta, carro, servicios…</div></div></button>
        <button className="bigbtn" onClick={go(ctx.openPayment)}><span>📌</span><div><b>Agregar un pago nuevo</b><div className="note">Algo que pagas cada mes</div></div></button>
      </div>
    </Modal>
  )
}

// Elimina un apartado; si ya tiene historial lo archiva (y exige que su saldo esté en cero).
export async function removeEnvelope(D, e) {
  const bal = totals(D).env[e.id]?.balance || 0
  if (HOLDS.includes(e.kind) && Math.abs(bal) >= 0.5) {
    window.alert(`"${e.name}" tiene ${mxn(bal)} guardados. Primero pasa ese dinero a otro destino (botón "Mover dinero") y luego podrás quitarlo.`)
    return
  }
  const used = D.allocations.some((a) => a.envelope_id === e.id) || D.transactions.some((t) => t.envelope_id === e.id) || D.loans.some((l) => l.envelope_id === e.id)
  if (!used) {
    if (window.confirm(`¿Eliminar "${e.name}"?`)) await run(supabase.from('envelopes').delete().eq('id', e.id), D.reload, 'Eliminado')
  } else if (window.confirm(`"${e.name}" ya tiene movimientos, así que se archivará (deja de aparecer pero se conserva el historial). ¿Continuar?`)) {
    await run(supabase.from('envelopes').update({ archived: true }).eq('id', e.id), D.reload, 'Archivado')
  }
}
