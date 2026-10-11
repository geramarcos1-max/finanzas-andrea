import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeNetWorth, useData } from '../lib/DataContext'
import { mxn, mxn0, pct, today } from '../lib/format'
import { Bar, Empty, ErrorMsg, Kpi } from '../ui'

const ACC_TYPES = {
  bank: 'Cuenta bancaria', cash: 'Efectivo', savings: 'Ahorro', credit_card: 'Tarjeta de crédito', investment: 'Inversión',
}
const INV_TYPES = ['CETES', 'Fondo de inversión', 'Acciones / ETF', 'Cripto', 'Afore / retiro', 'Otro']

async function run(promise, reload) {
  const { error } = await promise
  if (error) alert(error.message); else reload()
}

function Accounts({ D }) {
  const blank = { name: '', type: 'bank', initial_balance: '' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const add = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    await run(supabase.from('accounts').insert({ name: f.name.trim(), type: f.type, initial_balance: Number(f.initial_balance) || 0 }), D.reload)
    setF(blank)
  }
  return (
    <div className="card">
      <h2>Cuentas</h2>
      {D.balances.filter((b) => !b.archived).length === 0 ? <Empty>Agrega tu primera cuenta (banco, efectivo…).</Empty> : (
        <div className="list">
          {D.balances.filter((b) => !b.archived).map((b) => (
            <div className="row" key={b.id}>
              <div className="grow"><div className="title">{b.name}</div><div className="small muted">{ACC_TYPES[b.type]}</div></div>
              <span className={`amount ${b.balance < 0 ? 'neg' : ''}`}>{mxn(b.balance)}</span>
              <button className="btn ghost sm" title="Ajustar saldo inicial" onClick={() => {
                const a = D.accounts.find((x) => x.id === b.id)
                const v = prompt('Saldo inicial de la cuenta (antes de tus movimientos):', a.initial_balance)
                if (v !== null && !isNaN(Number(v))) run(supabase.from('accounts').update({ initial_balance: Number(v) }).eq('id', b.id), D.reload)
              }}>Saldo inicial</button>
              <button className="btn danger sm" title="Archivar" onClick={() => confirm(`¿Archivar "${b.name}"?`) && run(supabase.from('accounts').update({ archived: true }).eq('id', b.id), D.reload)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
        <div><label>Nombre</label><input value={f.name} onChange={set('name')} placeholder="BBVA, Efectivo…" /></div>
        <div><label>Tipo</label><select value={f.type} onChange={set('type')}>{Object.entries(ACC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label>Saldo actual</label><input type="number" step="0.01" value={f.initial_balance} onChange={set('initial_balance')} placeholder="0.00" /></div>
        <button className="btn">Agregar</button>
      </form>
      <p className="small muted" style={{ marginBottom: 0 }}>Para tarjetas de crédito, captura el saldo que debes como número negativo.</p>
    </div>
  )
}

function Investments({ D }) {
  const blank = { name: '', type: INV_TYPES[0], invested_amount: '', current_value: '' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const list = D.investments.filter((i) => !i.archived)
  const add = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const inv = Number(f.invested_amount) || 0
    await run(supabase.from('investments').insert({ name: f.name.trim(), type: f.type, invested_amount: inv, current_value: f.current_value === '' ? inv : Number(f.current_value) }), D.reload)
    setF(blank)
  }
  return (
    <div className="card">
      <h2>Inversiones</h2>
      {list.length === 0 ? <Empty>Cuando empieces a invertir, regístralo aquí y actualiza su valor cada semana.</Empty> : (
        <div className="list">
          {list.map((i) => {
            const gain = Number(i.current_value) - Number(i.invested_amount)
            return (
              <div className="row" key={i.id}>
                <div className="grow">
                  <div className="title">{i.name}</div>
                  <div className="small muted">{i.type} · Invertido {mxn0(i.invested_amount)} · <span className={gain >= 0 ? 'pos' : 'neg'}>{gain >= 0 ? '+' : ''}{mxn0(gain)} ({pct(i.invested_amount > 0 ? (gain / i.invested_amount) * 100 : 0)})</span></div>
                </div>
                <span className="amount">{mxn(i.current_value)}</span>
                <button className="btn ghost sm" onClick={() => {
                  const v = prompt('Valor actual de la inversión:', i.current_value)
                  if (v !== null && !isNaN(Number(v))) run(supabase.from('investments').update({ current_value: Number(v), updated_at: new Date().toISOString() }).eq('id', i.id), D.reload)
                }}>Actualizar</button>
                <button className="btn danger sm" onClick={() => confirm(`¿Quitar "${i.name}"?`) && run(supabase.from('investments').update({ archived: true }).eq('id', i.id), D.reload)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
      <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
        <div><label>Nombre</label><input value={f.name} onChange={set('name')} placeholder="CETES 28 días" /></div>
        <div><label>Tipo</label><select value={f.type} onChange={set('type')}>{INV_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label>Monto invertido</label><input type="number" step="0.01" value={f.invested_amount} onChange={set('invested_amount')} /></div>
        <div><label>Valor actual</label><input type="number" step="0.01" value={f.current_value} onChange={set('current_value')} /></div>
        <button className="btn">Agregar</button>
      </form>
    </div>
  )
}

function Debts({ D }) {
  const blank = { name: '', original_amount: '', already_paid: '', monthly_payment: '', interest_rate: '', payment_day: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const list = D.debts.filter((d) => !d.archived)
  const accounts = D.accounts.filter((a) => !a.archived)

  const add = async (e) => {
    e.preventDefault(); setError('')
    if (!f.name.trim() || !(Number(f.original_amount) > 0)) return setError('Escribe el nombre y el monto total de la deuda.')
    await run(supabase.from('debts').insert({
      name: f.name.trim(), original_amount: Number(f.original_amount), already_paid: Number(f.already_paid) || 0,
      monthly_payment: f.monthly_payment ? Number(f.monthly_payment) : null,
      interest_rate: f.interest_rate ? Number(f.interest_rate) : null,
      payment_day: f.payment_day ? Number(f.payment_day) : null,
    }), D.reload)
    setF(blank)
  }

  async function pay(d) {
    if (!accounts.length) return alert('Primero crea una cuenta.')
    const amount = Number(prompt(`Monto del pago a "${d.name}":`, d.monthly_payment || ''))
    if (!(amount > 0)) return
    const cat = D.categories.find((c) => c.name === 'Pago de carro' && d.name.toLowerCase().includes('carro')) || D.categories.find((c) => c.name === 'Otros gastos')
    const names = accounts.map((a, i) => `${i + 1}. ${a.name}`).join('\n')
    const pick = Number(prompt(`¿Desde qué cuenta pagas?\n${names}`, '1'))
    const acc = accounts[pick - 1]
    if (!acc) return
    await run(supabase.from('transactions').insert({ kind: 'expense', amount, date: today(), account_id: acc.id, category_id: cat?.id || null, debt_id: d.id, note: `Pago ${d.name}` }), D.reload)
  }

  return (
    <div className="card">
      <h2>Deudas (carro, préstamos…)</h2>
      {list.length === 0 ? <Empty>Registra aquí el pago de tu carro u otras deudas para ver cuánto te falta.</Empty> : (
        <div className="stack">
          {list.map((d) => (
            <div key={d.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div><b>{d.name}</b><div className="small muted">
                  {d.monthly_payment ? `Mensualidad ${mxn0(d.monthly_payment)}` : ''}{d.payment_day ? ` · día ${d.payment_day}` : ''}{d.interest_rate ? ` · ${d.interest_rate}% anual` : ''}
                </div></div>
                <div style={{ textAlign: 'right' }}><div className="amount">{mxn(d.remaining)}</div><div className="small muted">pendiente</div></div>
              </div>
              <div style={{ margin: '6px 0' }}><Bar value={Number(d.total_paid)} max={Number(d.original_amount)} tone="ok" /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small muted">Pagado {mxn0(d.total_paid)} de {mxn0(d.original_amount)}{d.monthly_payment && d.remaining > 0 ? ` · ~${Math.ceil(d.remaining / d.monthly_payment)} pagos restantes` : ''}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm" onClick={() => pay(d)}>Registrar pago</button>
                  <button className="btn danger sm" onClick={() => confirm(`¿Archivar "${d.name}"?`) && run(supabase.from('debts').update({ archived: true }).eq('id', d.id), D.reload)}>✕</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="form-grid" style={{ marginTop: 14 }}>
        <div><label>Nombre</label><input value={f.name} onChange={set('name')} placeholder="Carro" /></div>
        <div><label>Monto total de la deuda</label><input type="number" step="0.01" value={f.original_amount} onChange={set('original_amount')} /></div>
        <div><label>Ya pagado</label><input type="number" step="0.01" value={f.already_paid} onChange={set('already_paid')} /></div>
        <div><label>Mensualidad</label><input type="number" step="0.01" value={f.monthly_payment} onChange={set('monthly_payment')} /></div>
        <div><label>Día de pago</label><input type="number" min="1" max="31" value={f.payment_day} onChange={set('payment_day')} /></div>
        <div><label>Tasa anual % (opcional)</label><input type="number" step="0.01" value={f.interest_rate} onChange={set('interest_rate')} /></div>
        <button className="btn">Agregar</button>
      </form>
      <ErrorMsg msg={error} />
    </div>
  )
}

export default function Wealth() {
  const D = useData()
  const nw = computeNetWorth(D)
  return (
    <>
      <div className="page-head"><h1>Patrimonio</h1></div>
      <div className="grid kpis">
        <Kpi hero title="Patrimonio neto" value={mxn0(nw.total)} />
        <Kpi title="Cuentas y efectivo" value={mxn0(nw.cash)} />
        <Kpi title="Inversiones" value={mxn0(nw.inv)} />
        <Kpi title="Deudas pendientes" value={mxn0(nw.debt)} />
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <Accounts D={D} />
        <Debts D={D} />
        <Investments D={D} />
      </div>
    </>
  )
}
