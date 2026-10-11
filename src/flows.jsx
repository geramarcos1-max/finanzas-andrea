import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useData } from './lib/DataContext'
import { GROUPS, cents, propose, r2, totals } from './lib/calc'
import { GROUP_WHY, catEmoji } from './lib/friendly'
import { fmtDate, mxn, mxn0, today } from './lib/format'
import { FormModal, Modal, MoneyInput, Pill, opts, run, toNum, toast } from './ui'

// ---------- Registrar / editar un gasto (sale de una cuenta y de un apartado) ----------
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
  if (!accounts.length) return <NeedAccount title={title} onClose={onClose} />
  const initial = editing
    ? { date: editing.date, amount: String(editing.amount), account_id: editing.account_id, category_id: editing.category_id || '', note: editing.note || '' }
    : { date: today(), amount: '', account_id: accounts[0].id, category_id: D.categories.find((c) => c.name === 'Otro')?.id || '', note: '', ...(prefill || {}) }

  return (
    <FormModal title={editing ? 'Editar gasto' : title} fields={fields} initial={initial} onClose={onClose}
      onSave={async (v) => {
        if (envId) {
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
  const envs = D.envelopes.filter((e) => !e.archived)
  const fields = [
    { key: 'from', label: 'Tomar de', type: 'select', options: [{ value: 'unassigned', label: `Dinero sin destino (${mxn(t.unassigned)})` }, ...envs.map((e) => ({ value: e.id, label: `${e.name} (${mxn(t.env[e.id]?.balance || 0)})` }))] },
    { key: 'to', label: 'Pasar a', type: 'select', options: opts(envs) },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'date', label: 'Fecha', type: 'date', required: true },
  ]
  return (
    <FormModal title="Mover dinero" sub="Tu dinero no sale del banco; solo cambia de apartado." fields={fields} onClose={onClose}
      initial={{ from: fromEnvId || 'unassigned', to: toEnvId || envs[0]?.id, amount: '', date: today() }}
      onSave={async (v) => {
        if (v.from === v.to) return 'Elige apartados distintos.'
        const available = v.from === 'unassigned' ? t.unassigned : t.env[v.from]?.balance || 0
        if (cents(v.amount) > cents(available)) return `Solo hay ${mxn(available)} disponibles ahí.`
        const rows = v.from === 'unassigned'
          ? [{ date: v.date, envelope_id: v.to, amount: v.amount, kind: 'unassigned' }]
          : [{ date: v.date, envelope_id: v.from, amount: -v.amount, kind: 'move', note: 'Movido a otro apartado' },
             { date: v.date, envelope_id: v.to, amount: v.amount, kind: 'move', note: 'Recibido de otro apartado' }]
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

// ---------- Me llegó dinero: datos -> propuesta -> guardaditos ----------
export function IncomeFlow({ mode = 'income', onClose }) {
  const D = useData()
  const nav = useNavigate()
  const t = totals(D)
  const sources = D.income_sources.filter((s) => !s.archived)
  const accounts = D.accounts.filter((a) => !a.archived)
  const assign = mode === 'assign'
  const [step, setStep] = useState('form')
  const [f, setF] = useState({
    source: sources[0]?.id || '', amount: assign ? String(Math.max(0, t.unassigned)) : '', date: today(), account: accounts[0]?.id || '',
  })
  const [dateOpen, setDateOpen] = useState(false)
  const [lines, setLines] = useState([])
  const [edit, setEdit] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [incomeId, setIncomeId] = useState(null)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const amount = toNum(f.amount)
  const total = lines.reduce((a, l) => a + toNum(l.amount), 0)
  const diff = cents(amount) - cents(total)
  const accName = accounts.find((a) => a.id === f.account)?.name

  if (step === 'form' && !assign && !accounts.length) {
    return (
      <Modal onClose={onClose} title="Primero necesitas una cuenta"
        footer={<><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={() => { onClose(); nav('/cuentas') }}>Crear mi primera cuenta</button></>}>
        <p className="note">Un ingreso tiene que llegar a algún lado: tu cuenta de banco o tu efectivo. Créala con su saldo de hoy y regresa a registrar tu dinero.</p>
      </Modal>
    )
  }

  function toPlan() {
    if (!(amount > 0)) return setErr('Escribe cuánto te llegó.')
    if (assign && cents(amount) > cents(t.unassigned)) return setErr(`Solo tienes ${mxn(t.unassigned)} sin destino.`)
    setErr('')
    setLines(normalizeLines(propose(D, D.settings, amount, f.date)))
    setStep('plan')
  }

  async function accept() {
    setBusy(true)
    const payload = lines.filter((l) => toNum(l.amount) > 0).map((l) => ({ envelope_id: l.envelope_id, amount: toNum(l.amount) }))
    const { data, error } = assign
      ? await supabase.rpc('assign_unassigned', { p_date: f.date, p_lines: payload })
      : await supabase.rpc('register_income', { p_date: f.date, p_source: f.source || null, p_amount: amount, p_account: f.account, p_note: null, p_lines: payload })
    if (error) { setBusy(false); return toast('⚠️ ' + error.message) }
    await D.reload()
    setBusy(false)
    if (assign) { toast('Listo ✓ Tu dinero ya tiene destino'); return onClose() }
    setIncomeId(data); setStep('done')
  }

  // ----- Paso 1: ¿cuánto te llegó? -----
  if (step === 'form') {
    return (
      <Modal onClose={onClose} title={assign ? 'Dale destino a tu dinero' : '¿Cuánto te llegó?'}
        sub={assign ? `Tienes ${mxn(t.unassigned)} en tus cuentas que todavía no tienen destino.` : null}
        footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri big-action" onClick={toPlan}>Continuar</button></>}>
        <label className="f" style={{ marginTop: 10 }}>Monto
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
        {!assign && (accounts.length > 1 ? (
          <label className="f" style={{ marginTop: 14 }}>¿A qué cuenta llegó?
            <select value={f.account} onChange={(e) => set('account')(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </label>
        ) : <p className="note" style={{ marginTop: 12 }}>Llegó a <b>{accName}</b></p>)}
        <p className="note" style={{ marginTop: 10 }}>
          {f.date === today() ? 'Fecha: hoy' : `Fecha: ${fmtDate(f.date)}`}{' '}
          <button className="link edit" onClick={() => setDateOpen(!dateOpen)}>Cambiar</button>
        </p>
        {dateOpen && <input type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />}
        {err && <p className="note bad-t" role="alert">{err}</p>}
      </Modal>
    )
  }

  // ----- Paso 2: la propuesta -----
  if (step === 'plan') {
    let g = ''
    return (
      <Modal onClose={onClose} title="Te propongo esto"
        sub={`De tus ${mxn(amount)}, esto es lo que yo haría. Tú decides.`}
        footer={<>
          <div className="row">
            <button className="btn" onClick={() => setStep('form')}>Atrás</button>
            <button className="btn" onClick={() => { setEdit(!edit); if (edit) setLines(normalizeLines(propose(D, D.settings, amount, f.date))) }}>{edit ? 'Volver a mi propuesta' : 'Quiero cambiar algo'}</button>
          </div>
          <button className="btn pri big-action" disabled={diff !== 0 || busy} onClick={accept}>Está bien, aceptar</button>
        </>}>
        <div style={{ margin: '8px 0' }}>
          {lines.filter((l) => edit || toNum(l.amount) > 0 || l.falta > 0).map((l) => {
            const i = lines.findIndex((x) => x.envelope_id === l.envelope_id)
            const head = l.group !== g ? (g = l.group, (
              <div className="grp" key={'g' + l.group}>{GROUPS[l.group]}<div className="why">{GROUP_WHY[l.group]}</div></div>
            )) : null
            const cur = toNum(l.amount)
            return (
              <div key={l.envelope_id}>
                {head}
                <div className="propline">
                  <div className="n">
                    {l.name}{' '}
                    {l.falta > 0 && cur < l.falta && <Pill tone="warn">faltan {mxn0(l.falta - cur)}</Pill>}
                  </div>
                  {edit
                    ? <MoneyInput value={l.amount} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                    : <b className="num">{mxn(cur)}</b>}
                </div>
              </div>
            )
          })}
        </div>
        <div className={`callout ${diff === 0 ? 'good' : 'bad'}`}>
          {diff === 0 ? '✅ Todo tu dinero tiene destino.' : diff > 0 ? `Te faltan ${mxn(diff / 100)} por repartir.` : `Te pasaste por ${mxn(-diff / 100)}.`}
        </div>
      </Modal>
    )
  }

  // ----- Paso 3: guardaditos -----
  const moves = D.pending_moves.filter((m) => m.income_id === incomeId && !m.done_at)
  return (
    <Modal onClose={onClose} title="✅ ¡Listo! Tu ingreso quedó repartido"
      sub={moves.length ? 'Ahora haz estos guardaditos en la app de tu banco:' : 'Todo quedó apartado dentro de la app.'}
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
        <button className="bigbtn" onClick={() => { onClose(); nav('/pagos') }}><span>✅</span><div><b>Pagué una cuenta fija</b><div className="note">Renta, carro, servicios…</div></div></button>
      </div>
    </Modal>
  )
}

// Normaliza las líneas de propuesta a cadenas editables
export const normalizeLines = (ls) => ls.map((l) => ({ ...l, amount: String(r2(l.amount) || '') }))

// Elimina un apartado; si ya tiene historial lo archiva (y exige que su saldo esté en cero).
export async function removeEnvelope(D, e) {
  const bal = totals(D).env[e.id]?.balance || 0
  if (Math.abs(bal) >= 0.5) {
    window.alert(`"${e.name}" tiene ${mxn(bal)} apartados. Primero pasa ese dinero a otro apartado (botón "Mover dinero") y luego podrás quitarlo.`)
    return
  }
  const used = D.allocations.some((a) => a.envelope_id === e.id) || D.transactions.some((t) => t.envelope_id === e.id) || D.loans.some((l) => l.envelope_id === e.id)
  if (!used) {
    if (window.confirm(`¿Eliminar "${e.name}"?`)) await run(supabase.from('envelopes').delete().eq('id', e.id), D.reload, 'Eliminado')
  } else if (window.confirm(`"${e.name}" ya tiene movimientos, así que se archivará (deja de aparecer pero se conserva el historial). ¿Continuar?`)) {
    await run(supabase.from('envelopes').update({ archived: true }).eq('id', e.id), D.reload, 'Archivado')
  }
}
