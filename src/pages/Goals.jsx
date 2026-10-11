import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { envelopeStats, neededFor, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal, GoalFormModal, MoveModal, removeEnvelope } from '../flows'
import { Link } from 'react-router-dom'
import { Bar, Empty, Item, Kpi, PageHead, Pill } from '../ui'

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

  return (
    <>
      <Link to="/ahorros" className="note">← Mis ahorros</Link>
      <PageHead title="Mis metas" sub="Algo que quieres lograr, con su monto y fecha: un viaje, una compra, un proyecto. Yo calculo cuánto apartar cada mes.">
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
      {modal && <GoalFormModal editing={modal.editing} onClose={() => setModal(null)} />}
      {move && <MoveModal toEnvId={move} onClose={() => setMove(null)} />}
      {use && <ExpenseModal envId={use} title={`Usar dinero de “${D.envelopes.find((e) => e.id === use)?.name}”`} onClose={() => setUse(null)} />}
    </>
  )
}
