import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, ledgerOf, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, pct, today } from '../lib/format'
import { ExpenseModal, MoveModal } from '../flows'
import { Bar, Empty, FormModal, Item, Kpi, PageHead, confirmDel, run } from '../ui'

// Fondo de emergencia y ahorro a largo plazo (mismo comportamiento, distinto texto)
const TEXT = {
  emergency: {
    title: 'Fondo de emergencia',
    sub: (e, pctLT) => `Cada mes se apartan ${mxn0(e.monthly_amount)} para emergencias.`,
    use: 'Usé del fondo', useTitle: 'Usar dinero del fondo',
  },
  longterm: {
    title: 'Ahorro a largo plazo',
    sub: (e, pctLT) => `Dinero sin fecha de uso. Recibe el ${pctLT}% de cada ingreso y todo lo que sobre después de cubrir tus sobres.`,
    use: 'Retiré para gastar', useTitle: 'Retirar para gastar',
  },
}

export default function Savings({ kind }) {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [edit, setEdit] = useState(false)
  const env = D.envelopes.find((e) => e.kind === kind)
  const T = totals(D)
  if (!env) return null
  const tx = TEXT[kind]
  const bal = T.env[env.id]?.balance || 0
  const MES = today().slice(0, 7)
  const ledger = ledgerOf(D, env.id)
  const target = Number(env.target_amount) || 0

  async function remove(l) {
    if (confirmDel('este movimiento')) await run(supabase.from(l.del).delete().eq('id', l.id), D.reload, 'Eliminado')
  }

  return (
    <>
      <PageHead title={tx.title} sub={tx.sub(env, D.settings.longterm_pct)}>
        <button className="btn" onClick={() => setModal('move')}>Mover dinero</button>
        <button className="btn pri" onClick={() => setModal('use')}>{tx.use}</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Saldo" value={mxn0(bal)} tone={bal < 0 ? 'bad' : ''} />
        <Kpi label="Aporte mensual" value={mxn0(env.monthly_amount)} hint={<button className="link edit" onClick={() => setEdit(true)}>Cambiar</button>} />
        <Kpi label="Este mes" value={mxn0(allocatedIn(D, env.id, MES))} hint="Aportado" />
        {target > 0 && <Kpi label="Meta del fondo" value={mxn0(target)} hint={`${pct((bal / target) * 100)} · faltan ${mxn0(Math.max(0, target - bal))}`} />}
      </div>
      {target > 0 && <div style={{ marginTop: 12 }}><Bar value={bal} max={target} tone="good" /></div>}
      <h2>Movimientos</h2>
      <div className="list">
        {ledger.length === 0 ? <Empty>Sin movimientos. Los aportes llegan al repartir tus ingresos.</Empty> : ledger.map((l) => (
          <Item key={l.id} title={l.label} sub={`${fmtDate(l.date)}${l.sub ? ' · ' + l.sub : ''}`}
            right={<span className={l.amount < 0 ? 'bad-t' : 'good-t'}>{l.amount > 0 ? '+' : ''}{mxn(l.amount)}</span>}
            actions={l.del ? <button className="link" onClick={() => remove(l)}>Eliminar</button> : null} />
        ))}
      </div>
      {modal === 'use' && <ExpenseModal envId={env.id} title={tx.useTitle} onClose={() => setModal(null)} />}
      {modal === 'move' && <MoveModal toEnvId={env.id} onClose={() => setModal(null)} />}
      {edit && (
        <FormModal title={`Ajustes de ${tx.title.toLowerCase()}`} onClose={() => setEdit(false)}
          fields={[
            { key: 'monthly_amount', label: 'Aporte mensual', type: 'money', required: kind === 'emergency' },
            ...(kind === 'emergency' ? [{ key: 'target_amount', label: 'Meta del fondo (opcional)', type: 'money', placeholder: 'Ej. 50,000' }] : []),
          ]}
          initial={{ monthly_amount: String(env.monthly_amount || ''), target_amount: env.target_amount ? String(env.target_amount) : '' }}
          onSave={async (v) => (await run(supabase.from('envelopes').update({ monthly_amount: v.monthly_amount || 0, ...(kind === 'emergency' ? { target_amount: v.target_amount > 0 ? v.target_amount : null } : {}) }).eq('id', env.id), D.reload, 'Guardado')) ? true : 'No se pudo guardar'} />
      )}
    </>
  )
}
