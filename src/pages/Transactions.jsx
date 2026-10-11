import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { fmtDate, monthFirst, mxn, today } from '../lib/format'
import { Empty, ErrorMsg } from '../ui'

const KINDS = [
  { k: 'expense', label: 'Gasto' },
  { k: 'income', label: 'Ingreso' },
  { k: 'transfer', label: 'Transferencia' },
]

export default function Transactions() {
  const D = useData()
  const accounts = D.accounts.filter((a) => !a.archived)
  const blank = { kind: 'expense', amount: '', date: today(), account_id: '', to_account_id: '', category_id: '', debt_id: '', note: '' }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [month, setMonth] = useState(monthFirst().slice(0, 7))
  const [kindFilter, setKindFilter] = useState('')
  const [accFilter, setAccFilter] = useState('')
  const [q, setQ] = useState('')

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const cats = D.categories.filter((c) => !c.archived && c.kind === f.kind)

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amount = Number(f.amount)
    const account_id = f.account_id || accounts[0]?.id
    if (!account_id) return setError('Primero crea una cuenta en Patrimonio.')
    if (!(amount > 0)) return setError('Escribe un monto mayor a 0.')
    if (f.kind === 'transfer' && (!f.to_account_id || f.to_account_id === account_id)) return setError('Elige una cuenta destino distinta.')
    setBusy(true)
    const { error } = await supabase.from('transactions').insert({
      kind: f.kind, amount, date: f.date, account_id,
      to_account_id: f.kind === 'transfer' ? f.to_account_id : null,
      category_id: f.kind === 'transfer' ? null : f.category_id || null,
      debt_id: f.kind === 'expense' ? f.debt_id || null : null,
      note: f.note || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setF({ ...blank, kind: f.kind, date: f.date, account_id: f.account_id })
    D.reload()
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) alert(error.message); else D.reload()
  }

  const list = D.transactions.filter(
    (t) =>
      t.date.startsWith(month) &&
      (!kindFilter || t.kind === kindFilter) &&
      (!accFilter || t.account_id === accFilter || t.to_account_id === accFilter) &&
      (!q || (t.note || '').toLowerCase().includes(q.toLowerCase()))
  )
  const name = (arr, id) => arr.find((x) => x.id === id)?.name
  const totalIn = list.filter((t) => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = list.filter((t) => t.kind === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <>
      <div className="page-head"><h1>Movimientos</h1></div>

      <form className="card stack" onSubmit={submit} style={{ marginBottom: 16 }}>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {KINDS.map((k) => (
            <button type="button" key={k.k} className={f.kind === k.k ? 'on' : ''} onClick={() => setF({ ...f, kind: k.k, category_id: '', debt_id: '' })}>{k.label}</button>
          ))}
        </div>
        <div className="form-grid">
          <div><label>Monto (MXN)</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={f.amount} onChange={set('amount')} /></div>
          <div><label>Fecha</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div>
            <label>{f.kind === 'transfer' ? 'Cuenta origen' : 'Cuenta'}</label>
            <select value={f.account_id || accounts[0]?.id || ''} onChange={set('account_id')}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {f.kind === 'transfer' ? (
            <div>
              <label>Cuenta destino</label>
              <select value={f.to_account_id} onChange={set('to_account_id')}>
                <option value="">Elegir…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label>Categoría</label>
              <select value={f.category_id} onChange={set('category_id')}>
                <option value="">Sin categoría</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {f.kind === 'expense' && D.debts.some((d) => !d.archived) && (
            <div>
              <label>¿Es pago de una deuda?</label>
              <select value={f.debt_id} onChange={set('debt_id')}>
                <option value="">No</option>
                {D.debts.filter((d) => !d.archived).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ gridColumn: 'span 2' }}><label>Nota (opcional)</label><input value={f.note} onChange={set('note')} placeholder="Ej. Tacos con amigas" /></div>
        </div>
        <ErrorMsg msg={error} />
        <button className="btn" disabled={busy} style={{ alignSelf: 'flex-start' }}>Guardar movimiento</button>
      </form>

      <div className="card">
        <div className="filters" style={{ marginBottom: 12 }}>
          <div><label>Mes</label><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div><label>Tipo</label>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">Todos</option>{KINDS.map((k) => <option key={k.k} value={k.k}>{k.label}</option>)}
            </select>
          </div>
          <div><label>Cuenta</label>
            <select value={accFilter} onChange={(e) => setAccFilter(e.target.value)}>
              <option value="">Todas</option>{D.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}><label>Buscar</label><input placeholder="Buscar en notas…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>
          {list.length} movimientos · Ingresos <b className="pos">{mxn(totalIn)}</b> · Gastos <b className="neg">{mxn(totalOut)}</b>
        </div>
        {list.length === 0 ? <Empty>No hay movimientos con estos filtros.</Empty> : (
          <div className="list">
            {list.map((t) => {
              const c = D.categories.find((x) => x.id === t.category_id)
              const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : ''
              return (
                <div className="row" key={t.id}>
                  <span className="dot" style={{ background: c?.color || '#c7c7cc' }} />
                  <div className="grow">
                    <div className="title">{t.note || c?.name || (t.kind === 'transfer' ? 'Transferencia' : 'Sin categoría')}</div>
                    <div className="small muted">
                      {fmtDate(t.date)} · {name(D.accounts, t.account_id)}{t.to_account_id ? ` → ${name(D.accounts, t.to_account_id)}` : ''}
                      {c && ` · ${c.name}`}{t.debt_id && ' · Pago de deuda'}
                    </div>
                  </div>
                  <span className={`amount ${t.kind === 'income' ? 'pos' : t.kind === 'expense' ? 'neg' : ''}`}>{sign}{mxn(t.amount)}</span>
                  <button className="btn danger sm" onClick={() => remove(t.id)} aria-label="Eliminar">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
