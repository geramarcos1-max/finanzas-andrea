import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { allocatedIn, ledgerOf, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, today } from '../lib/format'
import { ExpenseModal, MoveModal } from '../flows'
import { Empty, FormModal, Item, Kpi, PageHead, confirmDel, opts, run } from '../ui'

// Ahorro e inversión (mismo comportamiento, distinto texto)
const TEXT = {
  savings: {
    title: 'Mi ahorro', ico: '🌱',
    sub: 'Dinero que guardas sin un fin específico. Recibe lo que decidas ahorrar cada vez que te llega dinero.',
    use: 'Retiré para gastar', useTitle: 'Retirar para gastar',
  },
  investment: {
    title: 'Mi inversión', ico: '📈',
    sub: 'Dinero que apartas para invertir. Aquí ves cuánto has destinado a invertir.',
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

  async function remove(l) {
    if (confirmDel('este movimiento')) await run(supabase.from(l.del).delete().eq('id', l.id), D.reload, 'Eliminado')
  }

  return (
    <>
      <Link to="/ahorros" className="note">← Mis ahorros</Link>
      <PageHead title={`${tx.ico} ${tx.title}`} sub={tx.sub}>
        <button className="btn" onClick={() => setModal('move')}>Mover dinero</button>
        <button className="btn pri" onClick={() => setModal('use')}>{tx.use}</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Llevas" value={mxn0(bal)} tone={bal < 0 ? 'bad' : ''} />
        <Kpi label="Este mes" value={mxn0(allocatedIn(D, env.id, MES))} hint="Lo que agregaste" />
        <Kpi label="¿Dónde lo guardas?" value={D.accounts.find((a) => a.id === env.account_id)?.name || 'Donde me llega'}
          hint={<button className="link edit" onClick={() => setEdit(true)}>Cambiar</button>} />
      </div>
      <h2>Movimientos</h2>
      <div className="list">
        {ledger.length === 0 ? <Empty>Aún no hay movimientos. Se agregan cuando registras un ingreso.</Empty> : ledger.map((l) => (
          <Item key={l.id} title={l.label} sub={`${fmtDate(l.date)}${l.sub ? ' · ' + l.sub : ''}`}
            right={<span className={l.amount < 0 ? 'bad-t' : 'good-t'}>{l.amount > 0 ? '+' : ''}{mxn(l.amount)}</span>}
            actions={l.del ? <button className="link" onClick={() => remove(l)}>Eliminar</button> : null} />
        ))}
      </div>
      {modal === 'use' && <ExpenseModal envId={env.id} title={tx.useTitle} onClose={() => setModal(null)} />}
      {modal === 'move' && <MoveModal toEnvId={env.id} onClose={() => setModal(null)} />}
      {edit && (
        <FormModal title={`¿Dónde guardas ${tx.title.toLowerCase()}?`} onClose={() => setEdit(false)}
          sub="Si lo guardas en una cajita o cuenta aparte del banco, la app te recordará pasar el dinero ahí cada vez."
          fields={[{ key: 'account_id', label: 'Cuenta', type: 'select', options: [{ value: '', label: 'En la cuenta donde me llega' }, ...opts(D.accounts.filter((a) => !a.archived))] }]}
          initial={{ account_id: env.account_id || '' }}
          onSave={async (v) => (await run(supabase.from('envelopes').update({ account_id: v.account_id || null }).eq('id', env.id), D.reload, 'Guardado')) ? true : 'No se pudo guardar'} />
      )}
    </>
  )
}
