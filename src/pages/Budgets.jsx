import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { catEmoji } from '../lib/friendly'
import { mxn, mxn0, today } from '../lib/format'
import { Bar, Empty, Kpi, MoneyInput, PageHead, run, toNum } from '../ui'

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
          onBlur={() => { if (toNum(v) !== (budget || 0)) onSave(cat.id, toNum(v)) }} />
      </div>
    </div>
  )
}

export default function Budgets() {
  const D = useData()
  const MES = today().slice(0, 7)
  const cats = D.categories.filter((c) => !c.archived && c.kind === 'expense')
  const budgetOf = (id) => Number(D.category_budgets.find((b) => b.category_id === id)?.amount) || 0
  const spentOf = (id) => D.transactions.filter((t) => t.kind === 'expense' && t.category_id === id && t.date.startsWith(MES)).reduce((s, t) => s + Number(t.amount), 0)
  const personal = D.envelopes.find((e) => e.kind === 'personal')

  const totalBudget = cats.reduce((s, c) => s + budgetOf(c.id), 0)
  const totalSpent = cats.reduce((s, c) => s + (budgetOf(c.id) ? spentOf(c.id) : 0), 0)

  async function save(categoryId, amount) {
    const q = amount > 0
      ? supabase.from('category_budgets').upsert({ category_id: categoryId, amount }, { onConflict: 'category_id' })
      : supabase.from('category_budgets').delete().eq('category_id', categoryId)
    await run(q, D.reload, amount > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')
  }

  return (
    <>
      <PageHead title="Mis presupuestos" sub="Un presupuesto es lo máximo que quieres gastar al mes en algo, por ejemplo en café o en salidas. Te aviso cuando te estés acercando." />
      <div className="kpis">
        <Kpi label="Presupuestado" value={mxn0(totalBudget)} hint={personal ? `Tienes ${mxn0(personal.monthly_amount)} al mes para gastar` : null} />
        <Kpi label="Gastado en esas categorías" value={mxn0(totalSpent)} tone={totalBudget && totalSpent > totalBudget ? 'bad' : ''} />
      </div>
      {totalBudget > Number(personal?.monthly_amount || 0) && personal?.monthly_amount > 0 && (
        <div className="callout warn">Tus presupuestos suman {mxn(totalBudget)}, más de los {mxn(personal.monthly_amount)} que apartas al mes para gastar. Quizá conviene bajar alguno.</div>
      )}
      <h2>Por categoría (este mes)</h2>
      <p className="note">Escribe cuánto quieres gastar como máximo. Déjalo vacío si no quieres límite.</p>
      <div className="list">
        {cats.length === 0 ? <Empty>No hay categorías.</Empty> : cats.map((c) => (
          <Row key={c.id + budgetOf(c.id)} cat={c} budget={budgetOf(c.id)} spent={spentOf(c.id)} onSave={save} />
        ))}
      </div>
    </>
  )
}
