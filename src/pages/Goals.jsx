import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { envelopeStats, neededFor, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal, MoveModal, removeEnvelope } from '../flows'
import { Bar, Empty, FormModal, Item, Kpi, PageHead, Pill, run } from '../ui'

export default function Goals() {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [move, setMove] = useState(null)
  const [use, setUse] = useState(null)
  const T = totals(D)
  const MES = today().slice(0, 7)
  const now = envelopeStats(D)
  const before = envelopeStats(D, MES + '-01')
  const goals = D.envelopes.filter((e) => !e.archived && e.kind === 'goal')
    .sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'))

  const state = (g, bal) => {
    const target = Number(g.target_amount)
    if (target && bal >= target) return ['Completa', 'good']
    if (!target) return ['Sin monto', 'warn']
    if (!g.target_date) return ['Sin fecha', 'warn']
    if (g.target_date < today()) return ['Vencida', 'bad']
    const months = (new Date(g.target_date + 'T00:00') - new Date()) / 2629800000
    return months <= 1 ? ['Vence este mes', 'warn'] : ['En camino', 'good']
  }

  const fields = [
    { key: 'name', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej. Viaje a Oaxaca' },
    { key: 'target_amount', label: 'Monto de la meta', type: 'money', required: true },
    { key: 'target_date', label: 'Fecha límite', type: 'date' },
    { key: 'monthly_amount', label: 'Apartado mensual fijo (solo si no hay fecha)', type: 'money', placeholder: 'Opcional' },
  ]
  const save = (editing) => async (v) => {
    const row = { kind: 'goal', name: v.name.trim(), target_amount: v.target_amount, target_date: v.target_date || null, monthly_amount: v.monthly_amount || 0 }
    const q = editing ? supabase.from('envelopes').update(row).eq('id', editing.id) : supabase.from('envelopes').insert(row)
    return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
  }

  return (
    <>
      <PageHead title="Ahorros con meta" sub="Viajes, imprevistos, proyectos y compras, cada uno con su monto, fecha límite y avance. El sistema calcula cuánto apartar cada mes y lo incluye en el reparto de tus ingresos.">
        <button className="btn pri" onClick={() => setModal({})}>+ Nueva meta</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Ahorrado en metas" value={mxn0(goals.reduce((s, g) => s + (now[g.id]?.balance || 0), 0))} />
        <Kpi label="Apartar este mes" value={mxn0(goals.reduce((s, g) => s + neededFor(g, D, MES, now, before), 0))} hint="Suma de las cuotas mensuales" />
      </div>
      <h2>Metas</h2>
      <div className="list">
        {goals.length === 0 ? <Empty>Aún no tienes metas. Crea la primera con “+ Nueva meta”.</Empty> : goals.map((g) => {
          const bal = now[g.id]?.balance || 0
          const target = Number(g.target_amount) || 0
          const [label, tone] = state(g, bal)
          return (
            <Item key={g.id} title={<>{g.name} <Pill tone={tone}>{label}</Pill></>}
              sub={`${g.target_date ? 'Límite ' + fmtDate(g.target_date) : 'Sin fecha límite'} · Apartar este mes ${mxn0(neededFor(g, D, MES, now, before))}`}
              right={mxn(bal)} rightSub={target ? `de ${mxn0(target)} · ${pct((bal / target) * 100)}` : null}
              actions={<><button className="link edit" onClick={() => setMove(g.id)}>Aportar</button>
                <button className="link edit" onClick={() => setUse(g.id)}>Usar</button>
                <button className="link edit" onClick={() => setModal({ editing: g })}>Editar</button>
                <button className="link" onClick={() => removeEnvelope(D, g)}>Quitar</button></>}>
              {target > 0 && <div style={{ marginTop: 6 }}><Bar value={bal} max={target} tone={tone} /></div>}
            </Item>
          )
        })}
      </div>
      {modal && <FormModal title={modal.editing ? 'Editar meta' : 'Nueva meta'} fields={fields} onClose={() => setModal(null)}
        initial={modal.editing ? { name: modal.editing.name, target_amount: String(modal.editing.target_amount || ''), target_date: modal.editing.target_date || '', monthly_amount: modal.editing.monthly_amount ? String(modal.editing.monthly_amount) : '' } : {}}
        onSave={save(modal.editing)} />}
      {move && <MoveModal toEnvId={move} onClose={() => setMove(null)} />}
      {use && <ExpenseModal envId={use} title={`Usar dinero de “${D.envelopes.find((e) => e.id === use)?.name}”`} onClose={() => setUse(null)} />}
    </>
  )
}
