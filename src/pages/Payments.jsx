import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { debtInfo, paymentsOf } from '../lib/calc'
import { dueText } from '../lib/friendly'
import { mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal, PaymentFormModal, removeEnvelope } from '../flows'
import { Bar, Empty, Item, Kpi, PageHead, Pill, run } from '../ui'

// "Mis pagos": se configuran los pagos que se repiten cada mes y funcionan como checklist.
export default function Payments() {
  const D = useData()
  const MES = today().slice(0, 7)
  const [month, setMonth] = useState(MES)
  const [pay, setPay] = useState(null)
  const [modal, setModal] = useState(null)
  const day = new Date().getDate()
  const isCurrent = month === MES
  const isPast = month < MES

  const rows = paymentsOf(D, month).map((r) => {
    const due = r.e.due_day
    let status = ['Pendiente', '']
    if (r.done) status = ['Pagado', 'good']
    else if (r.paid > 0) status = ['Parcial', 'warn']
    else if (isPast) status = ['No pagado', 'bad']
    else if (isCurrent && due && due < day) status = ['Vencido', 'bad']
    else if (isCurrent && due && due - day <= 3) status = ['Vence pronto', 'warn']
    return { ...r, status }
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
      <PageHead title="Mis pagos" sub="Lo que pagas cada mes. Agrégalo una vez y aquí lo vas marcando cuando lo pagues.">
        <button className="btn pri" onClick={() => setModal({})}>+ Agregar pago</button>
      </PageHead>
      <div className="filters">
        <label className="f">Mes<input type="month" value={month} onChange={(e) => setMonth(e.target.value || MES)} /></label>
        {!isCurrent && <button className="btn" onClick={() => setMonth(MES)}>Volver al mes actual</button>}
      </div>
      <div className="kpis">
        <Kpi label="Pagados" value={`${hechos} de ${rows.length}`} />
        <Kpi label="Ya pagaste" value={mxn0(totalPaid)} />
        <Kpi label="Te falta pagar" value={mxn0(Math.max(0, totalNeed - totalPaid))} tone={totalNeed - totalPaid > 0 ? 'warn' : 'good'} />
        <div className="kpi"><div className="l">Avance</div><div style={{ marginTop: 12 }}><Bar value={hechos} max={rows.length} tone="good" /></div><div className="h">{pct(rows.length ? (hechos / rows.length) * 100 : 0)}% completado</div></div>
      </div>

      <h2>Checklist del mes</h2>
      <div className="list">
        {rows.length === 0 ? <Empty>Aún no tienes pagos. Toca <b>+ Agregar pago</b> y escribe, por ejemplo, tu renta o el pago del carro.</Empty> : rows.map(({ e, need, paid, done, status }) => {
          const info = debtInfo(e, D)
          return (
            <Item key={e.id}
              title={<>{e.name} <Pill tone={status[1]}>{status[0]}</Pill></>}
              sub={`${e.due_day ? 'Se paga el día ' + e.due_day + (isCurrent && !done ? ' · ' + dueText(e.due_day) : '') : 'Sin día fijo'}${e.kind === 'debt' ? ' · Deuda' : ''}`}
              right={paid > 0 && !done ? mxn(paid) : mxn(need)} rightSub={paid > 0 && !done ? `de ${mxn(need)}` : null}
              actions={<>
                {paid > 0 && <button className="link" onClick={() => undo(e)}>Deshacer</button>}
                <button className="link edit" onClick={() => setModal({ editing: e })}>Editar</button>
                <button className="link" onClick={() => removeEnvelope(D, e)}>Quitar</button></>}>
              {!done && <div style={{ marginTop: 6 }}><button className="btn pri sm" onClick={() => setPay({ e, need: Math.max(0, need - paid) })}>Marcar pagado</button></div>}
              {info && (
                <div style={{ marginTop: 8 }}>
                  <Bar value={info.paid} max={info.total} tone="good" />
                  <div className="note">Pagado {mxn0(info.paid)} de {mxn0(info.total)} · Faltan {mxn0(info.remaining)}
                    {e.monthly_amount > 0 && info.remaining > 0 ? ` (~${Math.ceil(info.remaining / e.monthly_amount)} pagos)` : ''}</div>
                </div>
              )}
            </Item>
          )
        })}
      </div>
      <p className="note" style={{ marginTop: 10 }}>También puedes marcar pagos al registrar un ingreso con <b>“Me llegó dinero”</b>. Al marcar un pago, sale de la cuenta que elijas.</p>

      {pay && <ExpenseModal envId={pay.e.id} noCheck title={`Pagar ${pay.e.name}`}
        prefill={{ date: month === MES ? today() : `${month}-01`, amount: String(pay.need), note: pay.e.name }}
        onClose={() => setPay(null)} />}
      {modal && <PaymentFormModal editing={modal.editing} onClose={() => setModal(null)} />}
    </>
  )
}
