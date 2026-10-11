import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { monthFirst, mxn, mxn0 } from '../lib/format'
import { Bar, Empty } from '../ui'

export default function Budgets() {
  const D = useData()
  const [month, setMonth] = useState(monthFirst().slice(0, 7))
  const mDate = `${month}-01`
  const cats = D.categories.filter((c) => c.kind === 'expense' && !c.archived)

  const rows = cats.map((c) => {
    const b = D.budgets.find((x) => x.category_id === c.id && x.month === mDate)
    const spent = D.transactions
      .filter((t) => t.kind === 'expense' && t.category_id === c.id && t.date.startsWith(month))
      .reduce((s, t) => s + Number(t.amount), 0)
    return { c, budget: b ? Number(b.amount) : 0, has: !!b, spent }
  })
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalSpent = rows.reduce((s, r) => s + (r.budget ? r.spent : 0), 0)

  async function save(categoryId, value) {
    if (value === '' || value === null) {
      await supabase.from('budgets').delete().eq('category_id', categoryId).eq('month', mDate)
    } else {
      const { error } = await supabase.from('budgets').upsert(
        { category_id: categoryId, month: mDate, amount: Number(value) },
        { onConflict: 'category_id,month' }
      )
      if (error) return alert(error.message)
    }
    D.reload()
  }

  async function copyPrev() {
    const [y, m] = month.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const pk = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
    const src = D.budgets.filter((b) => b.month === pk)
    if (!src.length) return alert('El mes anterior no tiene presupuesto.')
    const { error } = await supabase.from('budgets').upsert(
      src.map((b) => ({ category_id: b.category_id, month: mDate, amount: b.amount })),
      { onConflict: 'category_id,month' }
    )
    if (error) alert(error.message); else D.reload()
  }

  return (
    <>
      <div className="page-head">
        <h1>Presupuestos</h1>
        <div className="filters">
          <div><label>Mes</label><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <button className="btn ghost" onClick={copyPrev}>Copiar mes anterior</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Total presupuestado</h2>
          <b>{mxn0(totalSpent)} <span className="muted">de {mxn0(totalBudget)}</span></b>
        </div>
        <div style={{ marginTop: 10 }}>
          <Bar value={totalSpent} max={totalBudget} tone={totalSpent > totalBudget ? 'over' : totalSpent > totalBudget * 0.8 ? 'warn' : 'ok'} />
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          {totalBudget > 0 ? (totalBudget - totalSpent >= 0 ? `Te quedan ${mxn(totalBudget - totalSpent)}` : `Te pasaste por ${mxn(totalSpent - totalBudget)}`) : 'Escribe un monto en cada categoría para empezar.'}
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? <Empty>No hay categorías de gasto.</Empty> : (
          <div className="list">
            {rows.map(({ c, budget, spent, has }) => {
              const r = budget ? spent / budget : 0
              return (
                <div className="row" key={`${c.id}-${month}`} style={{ flexWrap: 'wrap' }}>
                  <span className="dot" style={{ background: c.color || '#c7c7cc' }} />
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div className="title">{c.name}</div>
                    <div className="small muted">Gastado {mxn0(spent)}{has && ` · ${budget - spent >= 0 ? 'restan' : 'excedido'} ${mxn0(Math.abs(budget - spent))}`}</div>
                    {has && <div style={{ marginTop: 6 }}><Bar value={spent} max={budget} tone={r > 1 ? 'over' : r > 0.8 ? 'warn' : 'ok'} /></div>}
                  </div>
                  <div style={{ width: 130 }}>
                    <input type="number" min="0" step="1" placeholder="Sin límite" defaultValue={has ? budget : ''}
                      onBlur={(e) => { if (e.target.value !== (has ? String(budget) : '')) save(c.id, e.target.value) }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
