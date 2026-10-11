import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, spentIn, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal } from '../flows'
import { Bar, Empty, Item, Kpi, PageHead, Pill, confirmDel, run } from '../ui'

export default function Personal() {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [month, setMonth] = useState(today().slice(0, 7))
  const env = D.envelopes.find((e) => e.kind === 'personal')
  const T = totals(D)
  if (!env) return null

  const monthly = Number(env.monthly_amount)
  const spent = spentIn(D, env.id, month)
  const balance = T.env[env.id]?.balance || 0
  const list = D.transactions.filter((t) => t.envelope_id === env.id && t.kind === 'expense' && t.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const byCat = {}
  list.forEach((t) => { const n = D.categories.find((c) => c.id === t.category_id)?.name || 'Otro'; byCat[n] = (byCat[n] || 0) + Number(t.amount) })

  async function remove(t) {
    if (confirmDel('este gasto')) await run(supabase.from('transactions').delete().eq('id', t.id), D.reload, 'Eliminado')
  }

  return (
    <>
      <PageHead title="Gastos personales" sub={`Cada mes se aparta ${mxn0(monthly)} para ti. Registra aquí en qué los usas.`}>
        <button className="btn pri" onClick={() => setModal({})}>+ Registrar gasto</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Gastado" value={mxn0(spent)} hint={`en el mes elegido`} />
        <Kpi label="Disponible en tu sobre" value={mxn0(balance)} tone={balance < 0 ? 'bad' : 'good'} hint="Lo no gastado se acumula" />
        <Kpi label="Apartado este mes" value={mxn0(allocatedIn(D, env.id, month))} hint={`de ${mxn0(monthly)}`} />
        <div className="kpi" style={{ gridColumn: 'span 2' }}>
          <div className="l">Uso del mes</div>
          <div style={{ marginTop: 12 }}><Bar value={spent} max={monthly} tone={spent > monthly ? 'bad' : spent > monthly * 0.8 ? 'warn' : 'good'} /></div>
          <div className="h">{Object.entries(byCat).map(([c, v]) => `${c} ${mxn0(v)}`).join(' · ') || 'Sin gastos este mes'}</div>
        </div>
      </div>
      {balance < 0 && <div className="callout bad">Gastaste más de lo que tenías apartado en tu sobre personal.</div>}

      <div className="filters" style={{ marginTop: 22 }}>
        <label className="f">Mes<input type="month" value={month} onChange={(e) => setMonth(e.target.value || today().slice(0, 7))} /></label>
      </div>
      <div className="list">
        {list.length === 0 ? <Empty>Sin gastos registrados en este mes.</Empty> : list.map((t) => {
          const c = D.categories.find((x) => x.id === t.category_id)
          return (
            <Item key={t.id} title={t.note || c?.name || 'Gasto'} right={mxn(t.amount)}
              sub={<>{fmtDate(t.date)} · {D.accounts.find((a) => a.id === t.account_id)?.name} {c && <Pill>{c.name}</Pill>}</>}
              actions={<><button className="link edit" onClick={() => setModal({ editing: t })}>Editar</button><button className="link" onClick={() => remove(t)}>Eliminar</button></>} />
          )
        })}
      </div>
      {modal && <ExpenseModal envId={env.id} withCategory editing={modal.editing} onClose={() => setModal(null)} />}
    </>
  )
}
