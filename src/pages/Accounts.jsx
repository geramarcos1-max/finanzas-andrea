import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { cents, netWorth, totals } from '../lib/calc'
import { fmtDate, mxn, mxn0, today } from '../lib/format'
import { Empty, FormModal, Item, Kpi, PageHead, Pill, confirmDel, opts, run } from '../ui'

const TYPES = [
  { value: 'bank', label: 'Cuenta bancaria' }, { value: 'cash', label: 'Efectivo' }, { value: 'savings', label: 'Ahorro' },
  { value: 'investment', label: 'Inversión' }, { value: 'credit_card', label: 'Tarjeta de crédito' },
]
const typeName = (t) => TYPES.find((x) => x.value === t)?.label

export default function Accounts({ ctx }) {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [transfer, setTransfer] = useState(false)
  const [value, setValue] = useState(null)
  const T = totals(D)
  const NW = netWorth(D)
  const list = D.accounts.filter((a) => !a.archived)

  const fields = [
    { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'BBVA, Efectivo…' },
    { key: 'type', label: 'Tipo', type: 'select', options: TYPES },
    { key: 'initial_balance', label: 'Saldo de hoy', type: 'money', placeholder: '0.00' },
  ]

  async function save(editing, v) {
    // El usuario captura el saldo ACTUAL; se guarda como saldo inicial ajustado por los movimientos ya registrados.
    const current = T.bal[editing?.id] ?? 0
    const initial = editing ? Number(editing.initial_balance) + (v.initial_balance - current) : v.initial_balance
    const row = { name: v.name.trim(), type: v.type, initial_balance: Math.round(initial * 100) / 100 }
    const q = editing ? supabase.from('accounts').update(row).eq('id', editing.id) : supabase.from('accounts').insert(row)
    return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
  }

  async function archive(a) {
    const used = D.incomes.some((i) => i.account_id === a.id) || D.transactions.some((t) => t.account_id === a.id || t.to_account_id === a.id) || D.loans.some((l) => l.account_id === a.id)
    if (Math.abs(T.bal[a.id] || 0) >= 0.5) return window.alert(`La cuenta tiene ${mxn(T.bal[a.id])}. Transfiere ese saldo a otra cuenta antes de quitarla.`)
    if (!used) { if (confirmDel(a.name)) await run(supabase.from('accounts').delete().eq('id', a.id), D.reload, 'Eliminada') }
    else if (window.confirm(`"${a.name}" ya tiene movimientos, así que se archivará. ¿Continuar?`)) await run(supabase.from('accounts').update({ archived: true }).eq('id', a.id), D.reload, 'Archivada')
  }

  return (
    <>
      <PageHead title="Mi dinero" sub="Dónde tienes tu dinero de verdad: bancos, cajitas, efectivo. Si tu banco tiene cajitas o apartados, créalos aquí como cuenta tipo Ahorro.">
        <button className="btn" disabled={list.length < 2} onClick={() => setTransfer(true)}>Transferir</button>
        <button className="btn pri" onClick={() => setModal({})}>+ Cuenta</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Lo que tengo en total" value={mxn0(NW.total)} />
        <Kpi label="En mis cuentas" value={mxn0(NW.accounts)} />
        <Kpi label="Me deben" value={mxn0(NW.owed)} hint="Préstamos familiares" />
        <Kpi label="Deudas" value={mxn0(NW.debts)} hint="Saldo pendiente (carro, etc.)" />
        <Kpi label="Dinero sin destino" value={mxn0(T.unassigned)} tone={Math.abs(T.unassigned) < 0.5 ? '' : T.unassigned > 0 ? 'warn' : 'bad'}
          hint={T.unassigned > 0.5 ? <button className="link edit" onClick={ctx.openAssign}>Darle destino</button> : 'Todo tiene destino ✓'} />
      </div>
      <h2>Cuentas</h2>
      <div className="list">
        {list.length === 0 ? <Empty>Agrega tu cuenta de banco y tu efectivo con su saldo de hoy.</Empty> : list.map((a) => (
          <Item key={a.id} title={<>{a.name} <Pill>{typeName(a.type)}</Pill></>} right={mxn(T.bal[a.id] || 0)}
            actions={<>
              {a.type === 'investment' && <button className="link edit" onClick={() => setValue(a)}>Actualizar valor</button>}
              <button className="link edit" onClick={() => setModal({ editing: a })}>Editar</button>
              <button className="link" onClick={() => archive(a)}>Quitar</button></>} />
        ))}
      </div>
      <p className="note" style={{ marginTop: 10 }}>Para una tarjeta de crédito, captura lo que debes como número negativo (ej. -3,500).</p>

      {modal && <FormModal title={modal.editing ? 'Editar cuenta' : 'Nueva cuenta'} fields={[
          fields[0], fields[1],
          { ...fields[2], label: modal.editing ? 'Saldo de hoy (corrige si no coincide con el banco)' : 'Saldo de hoy', type: 'money', signed: true, placeholder: '0.00' },
        ]} onClose={() => setModal(null)}
        initial={modal.editing ? { name: modal.editing.name, type: modal.editing.type, initial_balance: String(T.bal[modal.editing.id] ?? 0) } : { type: 'bank', initial_balance: '' }}
        onSave={(v) => save(modal.editing, v)} />}

      {transfer && <FormModal title="Transferir entre cuentas" sub="El dinero cambia de cuenta; tus apartados no cambian." onClose={() => setTransfer(false)}
        fields={[
          { key: 'date', label: 'Fecha', type: 'date', required: true },
          { key: 'account_id', label: 'De', type: 'select', options: opts(list) },
          { key: 'to_account_id', label: 'A', type: 'select', options: opts(list) },
          { key: 'amount', label: 'Monto', type: 'money', required: true },
        ]}
        initial={{ date: today(), account_id: list[0]?.id, to_account_id: list[1]?.id, amount: '' }}
        onSave={async (v) => {
          if (v.account_id === v.to_account_id) return 'Elige cuentas distintas.'
          return (await run(supabase.from('transactions').insert({ kind: 'transfer', date: v.date, amount: v.amount, account_id: v.account_id, to_account_id: v.to_account_id, note: 'Transferencia' }), D.reload, 'Transferido')) ? true : 'No se pudo guardar'
        }} />}

      {value && <FormModal title={`Actualizar valor de ${value.name}`} sub={`Valor registrado: ${mxn(T.bal[value.id] || 0)}. La diferencia se registra como rendimiento (o pérdida).`}
        onClose={() => setValue(null)} fields={[{ key: 'value', label: 'Valor actual', type: 'money', required: true }]}
        initial={{ value: String(T.bal[value.id] || '') }}
        onSave={async (v) => {
          const diff = Math.round((v.value - (T.bal[value.id] || 0)) * 100) / 100
          if (diff === 0) return true
          const q = diff > 0
            ? supabase.from('incomes').insert({ type: 'adjustment', date: today(), amount: diff, account_id: value.id, note: value.name })
            : supabase.from('transactions').insert({ kind: 'expense', date: today(), amount: -diff, account_id: value.id, note: `Ajuste de valor · ${value.name}` })
          return (await run(q, D.reload, 'Valor actualizado')) ? true : 'No se pudo guardar'
        }} />}
    </>
  )
}
