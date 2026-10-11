import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, cents, spentIn, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal } from '../flows'
import { Bar, Empty, Item, Kpi, PageHead, Pill, run } from '../ui'

export default function Payments() {
  const D = useData()
  const MES = today().slice(0, 7)
  const [month, setMonth] = useState(MES)
  const [pay, setPay] = useState(null)
  const T = totals(D)
  const day = new Date().getDate()
  const isCurrent = month === MES
  const isPast = month < MES

  const items = D.envelopes.filter((e) => !e.archived && (e.kind === 'fixed' || e.kind === 'debt') && Number(e.monthly_amount) > 0)
    .sort((a, b) => (a.due_day || 99) - (b.due_day || 99) || a.name.localeCompare(b.name))

  const rows = items.map((e) => {
    const need = Number(e.monthly_amount)
    const paid = spentIn(D, e.id, month)
    const done = cents(paid) >= cents(need)
    const due = e.due_day
    let status = ['Pendiente', '']
    if (done) status = ['Pagado', 'good']
    else if (paid > 0) status = ['Parcial', 'warn']
    else if (isPast) status = ['No pagado', 'bad']
    else if (isCurrent && due && due < day) status = ['Vencido', 'bad']
    else if (isCurrent && due && due - day <= 3) status = ['Vence pronto', 'warn']
    return { e, need, paid, done, status, funded: allocatedIn(D, e.id, month) }
  })
  const totalNeed = rows.reduce((s, r) => s + r.need, 0)
  const totalPaid = rows.reduce((s, r) => s + Math.min(r.paid, r.need), 0)
  const hechos = rows.filter((r) => r.done).length

  async function undo(e) {
    const last = D.transactions.filter((t) => t.envelope_id === e.id && t.kind === 'expense' && t.date.startsWith(month))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
    if (last) await run(supabase.from('transactions').delete().eq('id', last.id), D.reload, 'Pago deshecho')
  }

  return (
    <>
      <PageHead title="Pagos del mes" sub="Marca cada pago cuando lo hagas para saber qué te falta este mes." />
      <div className="filters">
        <label className="f">Mes<input type="month" value={month} onChange={(e) => setMonth(e.target.value || MES)} /></label>
        {!isCurrent && <button className="btn" onClick={() => setMonth(MES)}>Volver al mes actual</button>}
      </div>
      <div className="kpis">
        <Kpi label="Pagados" value={`${hechos} de ${rows.length}`} />
        <Kpi label="Pagado" value={mxn0(totalPaid)} />
        <Kpi label="Por pagar" value={mxn0(Math.max(0, totalNeed - totalPaid))} tone={totalNeed - totalPaid > 0 ? 'warn' : 'good'} />
        <div className="kpi"><div className="l">Avance</div><div style={{ marginTop: 12 }}><Bar value={hechos} max={rows.length} tone="good" /></div><div className="h">{pct(rows.length ? (hechos / rows.length) * 100 : 0)}% completado</div></div>
      </div>
      <h2>Checklist</h2>
      <div className="list">
        {rows.length === 0 ? <Empty>Agrega tus gastos fijos en la sección <b>Gastos fijos y deudas</b>.</Empty> : rows.map(({ e, need, paid, done, status, funded }) => {
          const bal = T.env[e.id]?.balance || 0
          return (
            <Item key={e.id}
              title={<>{e.name} <Pill tone={status[1]}>{status[0]}</Pill></>}
              sub={<>{e.due_day ? `Día ${e.due_day} · ` : ''}{e.kind === 'debt' ? 'Deuda · ' : ''}Apartado este mes {mxn0(funded)} de {mxn0(need)}{funded + 0.005 < need && !done ? ' ⚠️' : ''}</>}
              right={paid > 0 && !done ? `${mxn(paid)}` : mxn(need)} rightSub={paid > 0 && !done ? `de ${mxn(need)}` : null}
              actions={paid > 0
                ? <button className="link" onClick={() => undo(e)}>Deshacer</button>
                : null}>
              {!done && <div style={{ marginTop: 6 }}><button className="btn pri sm" onClick={() => setPay({ e, need: need - paid, bal })}>Marcar pagado</button></div>}
            </Item>
          )
        })}
      </div>
      <p className="note" style={{ marginTop: 10 }}>Al marcar un pago, sale de la cuenta que elijas y de lo que apartaste para ese pago. Si pagas un monto distinto, puedes ajustarlo.</p>
      {pay && <ExpenseModal envId={pay.e.id} title={`Pagar ${pay.e.name}`}
        prefill={{ date: month === MES ? today() : `${month}-01`, amount: String(pay.need), note: pay.e.name }}
        onClose={() => setPay(null)} />}
    </>
  )
}
