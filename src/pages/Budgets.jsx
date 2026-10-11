import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, cents, r2, spentIn } from '../lib/calc'
import { catEmoji } from '../lib/friendly'
import { mxn, mxn0, today } from '../lib/format'
import { Bar, Empty, Kpi, MoneyInput, PageHead, run, toNum, toast } from '../ui'

function Row({ cat, budget, spent, draft, room, onDraft, onCommit }) {
  const value = draft !== undefined ? draft : budget ? String(budget) : ''
  const typed = toNum(value)
  const has = budget > 0
  const ratio = has ? spent / budget : 0
  const tone = ratio > 1 ? 'bad' : ratio > 0.8 ? 'warn' : 'good'
  const over = r2(typed - room)   // cuánto se pasa esta categoría de lo que aún se puede repartir
  return (
    <div className="item" style={{ flexWrap: 'wrap' }}>
      <span style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{catEmoji(cat.name)}</span>
      <div className="main" style={{ minWidth: 150 }}>
        <div className="t">{cat.name}</div>
        <div className="note">
          Llevas {mxn0(spent)}{has && (budget - spent >= 0 ? ` · te quedan ${mxn0(budget - spent)}` : ` · te pasaste por ${mxn0(spent - budget)}`)}
        </div>
        {has && <div style={{ marginTop: 6 }}><Bar value={spent} max={budget} tone={tone} /></div>}
        {over > 0 && <div className="note bad-t" role="alert" style={{ marginTop: 4 }}>⚠️ Te pasas por {mxn(over)}. Aquí puedes poner máximo {mxn(Math.max(0, room))}.</div>}
      </div>
      <div style={{ width: 140 }}>
        <MoneyInput value={value} onChange={(v) => onDraft(cat.id, v)} placeholder="Sin límite" aria-invalid={over > 0}
          style={over > 0 ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : undefined}
          onBlur={() => onCommit(cat.id)} />
      </div>
    </div>
  )
}

// El presupuesto total del mes es lo que Andrea separó para gastar (paso 3 de "Me llegó dinero").
// Los límites por categoría son una forma de repartir ese monto.
export default function Budgets() {
  const D = useData()
  const MES = today().slice(0, 7)
  const [drafts, setDrafts] = useState({})   // lo que se está escribiendo y aún no se guarda
  const cats = D.categories.filter((c) => !c.archived && c.kind === 'expense')
  const personal = D.envelopes.find((e) => e.kind === 'personal')
  const budgetOf = (id) => Number(D.category_budgets.find((b) => b.category_id === id)?.amount) || 0
  const spentOf = (id) => D.transactions.filter((t) => t.kind === 'expense' && t.category_id === id && t.envelope_id === personal?.id && t.date.startsWith(MES)).reduce((s, t) => s + Number(t.amount), 0)

  const total = personal ? allocatedIn(D, personal.id, MES) : 0       // presupuesto del mes
  const spent = personal ? spentIn(D, personal.id, MES) : 0          // gastado en el mes
  const savedSum = r2(cats.reduce((s, c) => s + budgetOf(c.id), 0))  // ya guardado
  const liveOf = (c) => (drafts[c.id] !== undefined ? toNum(drafts[c.id]) : budgetOf(c.id))
  const assigned = r2(cats.reduce((s, c) => s + liveOf(c), 0))       // repartido, incluyendo lo que se está escribiendo
  const free = r2(total - assigned)
  const hasDraft = Object.keys(drafts).length > 0

  const setDraft = (id, v) => setDrafts((d) => ({ ...d, [id]: v }))
  const clearDraft = (id) => setDrafts((d) => { const n = { ...d }; delete n[id]; return n })

  async function commit(categoryId) {
    if (drafts[categoryId] === undefined) return
    const amount = toNum(drafts[categoryId])
    if (amount === budgetOf(categoryId)) return clearDraft(categoryId)
    const others = r2(savedSum - budgetOf(categoryId))
    if (cents(amount + others) > cents(total)) {
      toast(`⚠️ No se guardó: te pasas del presupuesto. Aquí puedes poner máximo ${mxn(Math.max(0, r2(total - others)))}.`)
      return   // se conserva lo escrito, en rojo, para que lo corrija
    }
    const q = amount > 0
      ? supabase.from('category_budgets').upsert({ category_id: categoryId, amount }, { onConflict: 'category_id' })
      : supabase.from('category_budgets').delete().eq('category_id', categoryId)
    if (await run(q, D.reload, amount > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')) clearDraft(categoryId)
  }

  return (
    <>
      <PageHead title="Mis presupuestos" sub="Tu presupuesto del mes es lo que separaste para gastar. Aquí lo repartes por categoría para saber cuánto puedes gastar en café, salidas, etc." />
      <div className="kpis">
        <Kpi label="Tu presupuesto del mes" value={mxn0(total)} hint="Lo que separaste para gastar" />
        <Kpi label="Repartido en categorías" value={mxn0(assigned)} tone={free < 0 ? 'bad' : ''}
          hint={free > 0 ? `Te faltan ${mxn0(free)} por repartir` : free < 0 ? `Te pasas por ${mxn0(-free)}` : total > 0 ? 'Todo repartido ✓' : null} />
        <Kpi label="Gastado este mes" value={mxn0(spent)} tone={total && spent > total ? 'bad' : ''}
          hint={total ? (spent <= total ? `Te quedan ${mxn0(total - spent)} del presupuesto` : `Te pasaste por ${mxn0(spent - total)}`) : null} />
      </div>
      {total > 0 && <div style={{ marginTop: 12 }}><Bar value={spent} max={total} tone={spent > total ? 'bad' : spent > total * 0.8 ? 'warn' : 'good'} /></div>}

      {total === 0 && (
        <div className="callout warn">
          Aún no has separado dinero para gastar este mes. Cuando registres un ingreso con <b>“Me llegó dinero”</b>, tú decides cuánto separar y aquí lo repartes por categoría.
        </div>
      )}
      {free < 0 && total > 0 && (
        <div className="callout bad" role="alert" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
          🚨 <b>Te estás pasando de tu presupuesto.</b> Tus límites suman {mxn(assigned)} y tu presupuesto del mes es {mxn(total)}: te pasas por <b>{mxn(-free)}</b>.
          {hasDraft ? ' Mientras no cuadre, los cambios no se guardan. Baja algún límite.' : ' Baja algún límite para que cuadre.'}
        </div>
      )}

      <h2>Por categoría</h2>
      <p className="note">Escribe cuánto quieres gastar como máximo en cada una. Entre todas no pueden pasar de {mxn(total)}. Déjalo vacío si no quieres límite.{' '}
        {total === 0 && <Link to="/personales">Ver mis gastos</Link>}</p>
      <div className="list">
        {cats.length === 0 ? <Empty>No hay categorías.</Empty> : cats.map((c) => (
          <Row key={c.id} cat={c} budget={budgetOf(c.id)} spent={spentOf(c.id)} draft={drafts[c.id]}
            room={r2(total - (assigned - liveOf(c)))} onDraft={setDraft} onCommit={commit} />
        ))}
      </div>
    </>
  )
}
