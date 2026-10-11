import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, cents, r2, spentIn } from '../lib/calc'
import { catEmoji } from '../lib/friendly'
import { mxn, mxn0, today } from '../lib/format'
import { Bar, Empty, Kpi, MoneyInput, PageHead, run, toNum, toast } from '../ui'

function Row({ cat, budget, spent, onSave }) {
  const [v, setV] = useState(budget ? String(budget) : '')
  const has = budget > 0
  const ratio = has ? spent / budget : 0
  const tone = ratio > 1 ? 'bad' : ratio > 0.8 ? 'warn' : 'good'
  return (
    <div className="item" style={{ flexWrap: 'wrap' }}>
      <span style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{catEmoji(cat.name)}</span>
      <div className="main" style={{ minWidth: 150 }}>
        <div className="t">{cat.name}</div>
        <div className="note">
          Llevas {mxn0(spent)}{has && (budget - spent >= 0 ? ` · te quedan ${mxn0(budget - spent)}` : ` · te pasaste por ${mxn0(spent - budget)}`)}
        </div>
        {has && <div style={{ marginTop: 6 }}><Bar value={spent} max={budget} tone={tone} /></div>}
      </div>
      <div style={{ width: 140 }}>
        <MoneyInput value={v} onChange={setV} placeholder="Sin límite"
          onBlur={async () => {
            if (toNum(v) === (budget || 0)) return
            const ok = await onSave(cat.id, toNum(v))
            if (ok === false) setV(budget ? String(budget) : '')
          }} />
      </div>
    </div>
  )
}

// El presupuesto total del mes es lo que Andrea separó para gastar (paso 3 de "Me llegó dinero").
// Los límites por categoría son una forma de repartir ese monto.
export default function Budgets() {
  const D = useData()
  const MES = today().slice(0, 7)
  const cats = D.categories.filter((c) => !c.archived && c.kind === 'expense')
  const personal = D.envelopes.find((e) => e.kind === 'personal')
  const budgetOf = (id) => Number(D.category_budgets.find((b) => b.category_id === id)?.amount) || 0
  const spentOf = (id) => D.transactions.filter((t) => t.kind === 'expense' && t.category_id === id && t.envelope_id === personal?.id && t.date.startsWith(MES)).reduce((s, t) => s + Number(t.amount), 0)

  const total = personal ? allocatedIn(D, personal.id, MES) : 0       // presupuesto del mes
  const spent = personal ? spentIn(D, personal.id, MES) : 0          // gastado en el mes
  const assigned = r2(cats.reduce((s, c) => s + budgetOf(c.id), 0))  // repartido en categorías
  const free = r2(total - assigned)

  async function save(categoryId, amount) {
    const others = r2(assigned - budgetOf(categoryId))
    if (cents(amount + others) > cents(total)) {
      toast(`⚠️ Solo puedes repartir ${mxn(Math.max(0, r2(total - others)))} en esta categoría (tu presupuesto del mes es ${mxn(total)}).`)
      return false
    }
    const q = amount > 0
      ? supabase.from('category_budgets').upsert({ category_id: categoryId, amount }, { onConflict: 'category_id' })
      : supabase.from('category_budgets').delete().eq('category_id', categoryId)
    return run(q, D.reload, amount > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')
  }

  return (
    <>
      <PageHead title="Mis presupuestos" sub="Tu presupuesto del mes es lo que separaste para gastar. Aquí lo repartes por categoría para saber cuánto puedes gastar en café, salidas, etc." />
      <div className="kpis">
        <Kpi label="Tu presupuesto del mes" value={mxn0(total)} hint="Lo que separaste para gastar" />
        <Kpi label="Repartido en categorías" value={mxn0(assigned)} tone={free < 0 ? 'bad' : ''}
          hint={free > 0 ? `Te faltan ${mxn0(free)} por repartir` : free < 0 ? `Te pasaste por ${mxn0(-free)}` : total > 0 ? 'Todo repartido ✓' : null} />
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
        <div className="callout bad">Tus límites suman {mxn(assigned)}, que es más que tu presupuesto de {mxn(total)}. Baja alguno para que cuadre.</div>
      )}

      <h2>Por categoría</h2>
      <p className="note">Escribe cuánto quieres gastar como máximo en cada una. Entre todas no pueden pasar de {mxn(total)}. Déjalo vacío si no quieres límite.{' '}
        {total === 0 && <Link to="/personales">Ver mis gastos</Link>}</p>
      <div className="list">
        {cats.length === 0 ? <Empty>No hay categorías.</Empty> : cats.map((c) => (
          <Row key={c.id + budgetOf(c.id)} cat={c} budget={budgetOf(c.id)} spent={spentOf(c.id)} onSave={save} />
        ))}
      </div>
    </>
  )
}
