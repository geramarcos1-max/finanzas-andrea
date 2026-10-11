import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { debtInfo, totals } from '../lib/calc'
import { mxn, mxn0 } from '../lib/format'
import { MoveModal, removeEnvelope } from '../flows'
import { Bar, Empty, FormModal, Item, Kpi, PageHead, Pill, run } from '../ui'

export default function Fixed() {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [move, setMove] = useState(null)
  const T = totals(D)
  const list = D.envelopes.filter((e) => !e.archived && (e.kind === 'fixed' || e.kind === 'debt'))
    .sort((a, b) => (a.due_day || 99) - (b.due_day || 99) || a.name.localeCompare(b.name))
  const total = list.reduce((s, e) => s + Number(e.monthly_amount), 0)

  const fields = [
    { key: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'fixed', label: 'Gasto fijo (renta, servicios…)' }, { value: 'debt', label: 'Deuda con saldo (carro, préstamo…)' }] },
    { key: 'name', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej. Renta' },
    { key: 'monthly_amount', label: 'Monto mensual', type: 'money', required: true },
    { key: 'due_day', label: 'Día de pago (1-31)', type: 'number', min: 1, max: 31, placeholder: 'Opcional' },
    { key: 'debt_total', label: 'Monto total de la deuda', type: 'money', show: (v) => v.kind === 'debt', placeholder: 'Opcional' },
    { key: 'debt_paid_before', label: 'Ya pagado antes de usar la app', type: 'money', show: (v) => v.kind === 'debt', placeholder: '0' },
  ]
  const save = (editing) => async (v) => {
    const row = {
      kind: v.kind, name: v.name.trim(), monthly_amount: v.monthly_amount, due_day: v.due_day ? Number(v.due_day) : null,
      debt_total: v.kind === 'debt' && v.debt_total > 0 ? v.debt_total : null, debt_paid_before: v.kind === 'debt' ? v.debt_paid_before || 0 : 0,
    }
    const q = editing ? supabase.from('envelopes').update(row).eq('id', editing.id) : supabase.from('envelopes').insert(row)
    return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
  }
  const initialOf = (e) => ({
    kind: e.kind, name: e.name, monthly_amount: String(e.monthly_amount || ''), due_day: e.due_day || '',
    debt_total: e.debt_total ? String(e.debt_total) : '', debt_paid_before: e.debt_paid_before ? String(e.debt_paid_before) : '',
  })

  return (
    <>
      <PageHead title="Gastos fijos y deudas" sub="Lo que pagas cada mes sin falta. Reciben dinero del reparto antes que tus gastos personales o tus metas (puedes cambiar el orden en Configuración).">
        <button className="btn pri" onClick={() => setModal({})}>+ Agregar</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Total mensual" value={mxn0(total)} hint={`${list.length} conceptos`} />
        <Kpi label="Deuda pendiente" value={mxn0(list.filter((e) => e.kind === 'debt').reduce((s, e) => s + (debtInfo(e, D)?.remaining || 0), 0))} />
      </div>
      <h2>Conceptos</h2>
      <div className="list">
        {list.length === 0 ? <Empty>Agrega tus gastos fijos: renta, servicios, celular, suscripciones…</Empty> : list.map((e) => {
          const info = debtInfo(e, D)
          return (
            <Item key={e.id} title={<>{e.name} {e.kind === 'debt' && <Pill>Deuda</Pill>}</>}
              sub={`${e.due_day ? `Se paga el día ${e.due_day}` : 'Sin día de pago'} · Apartado ahora ${mxn0(T.env[e.id]?.balance || 0)}`}
              right={mxn(e.monthly_amount)} rightSub="al mes"
              actions={<><button className="link edit" onClick={() => setModal({ editing: e })}>Editar</button>
                {Math.abs(T.env[e.id]?.balance || 0) >= 0.5 && <button className="link edit" onClick={() => setMove(e.id)}>Mover dinero</button>}
                <button className="link" onClick={() => removeEnvelope(D, e)}>Quitar</button></>}>
              {info && (
                <div style={{ marginTop: 6 }}>
                  <Bar value={info.paid} max={info.total} tone="good" />
                  <div className="note">Pagado {mxn0(info.paid)} de {mxn0(info.total)} · Faltan {mxn0(info.remaining)}
                    {e.monthly_amount > 0 && info.remaining > 0 ? ` (~${Math.ceil(info.remaining / e.monthly_amount)} pagos)` : ''}</div>
                </div>
              )}
            </Item>
          )
        })}
      </div>
      {modal && <FormModal title={modal.editing ? 'Editar' : 'Nuevo gasto fijo o deuda'} fields={fields}
        initial={modal.editing ? initialOf(modal.editing) : { kind: 'fixed' }} onSave={save(modal.editing)} onClose={() => setModal(null)} />}
      {move && <MoveModal fromEnvId={move} toEnvId={D.envelopes.find((e) => !e.archived && e.id !== move)?.id} onClose={() => setMove(null)} />}
    </>
  )
}
