import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { fmtDate, mxn, mxn0, today } from '../lib/format'
import { Empty, Item, Kpi, PageHead, confirmDel, run } from '../ui'

export default function Incomes({ ctx }) {
  const D = useData()
  const MES = today().slice(0, 7)
  const list = [...D.incomes].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const real = D.incomes.filter((i) => i.type === 'income')
  const thisMonth = real.filter((i) => i.date.startsWith(MES))

  async function remove(i) {
    if (!confirmDel(`este ingreso de ${mxn(i.amount)} y su reparto`)) return
    await run(supabase.from('incomes').delete().eq('id', i.id), D.reload, 'Ingreso eliminado')
  }

  return (
    <>
      <PageHead title="Ingresos" sub="Registra cada ingreso. Después de confirmarlo, el sistema te propone cómo repartirlo.">
        <button className="btn pri" onClick={ctx.openIncome}>+ Registrar ingreso</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Este mes" value={mxn0(thisMonth.reduce((s, i) => s + Number(i.amount), 0))} hint={`${thisMonth.length} registrados`} />
        <Kpi label="Total registrado" value={mxn0(real.reduce((s, i) => s + Number(i.amount), 0))} hint={`${real.length} ingresos`} />
      </div>
      <h2>Historial</h2>
      <div className="list">
        {list.length === 0 ? <Empty>Aún no registras ingresos.</Empty> : list.map((i) => {
          const src = D.income_sources.find((s) => s.id === i.source_id)?.name
          const reparto = D.allocations.filter((a) => a.income_id === i.id)
            .map((a) => ({ n: D.envelopes.find((e) => e.id === a.envelope_id)?.name || '—', v: Number(a.amount) }))
          return (
            <Item key={i.id} title={i.type === 'adjustment' ? `Rendimiento · ${i.note || 'ajuste'}` : src || 'Sin fuente'}
              sub={`${fmtDate(i.date)} · ${D.accounts.find((a) => a.id === i.account_id)?.name || ''}`}
              right={mxn(i.amount)}
              actions={<button className="link" onClick={() => remove(i)}>Eliminar</button>}>
              {reparto.length > 0 && <div className="note" style={{ marginTop: 4 }}>{reparto.map((r) => `${r.n} ${mxn0(r.v)}`).join(' · ')}</div>}
              {i.type === 'adjustment' && <div className="note" style={{ marginTop: 4 }}>Queda como dinero sin destino</div>}
            </Item>
          )
        })}
      </div>
    </>
  )
}
