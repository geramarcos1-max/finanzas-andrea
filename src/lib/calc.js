// Toda la lógica de dinero vive aquí (funciones puras sobre los datos cargados).
//
// Modelo:
//  - Cuentas: dónde está el dinero real. El "dinero total" es la suma de sus saldos.
//  - Pagos recurrentes (apartados tipo fixed/debt): se pagan y salen de la cuenta (gasto).
//  - Apartados con saldo (personal, metas, ahorro, inversión): dinero que sigue en las cuentas pero ya tiene destino.
//  - Dinero sin destino = dinero total - suma de apartados con saldo.
import { monthKey } from './format'

export const cents = (n) => Math.round((Number(n) || 0) * 100)
export const r2 = (n) => cents(n) / 100
const amt = (x) => Number(x.amount) || 0

export function accountBalances(D) {
  const m = {}
  D.accounts.forEach((a) => { m[a.id] = Number(a.initial_balance) || 0 })
  D.incomes.forEach((i) => { m[i.account_id] = (m[i.account_id] || 0) + amt(i) })
  D.transactions.forEach((t) => {
    m[t.account_id] = (m[t.account_id] || 0) - amt(t)
    if (t.kind === 'transfer') m[t.to_account_id] = (m[t.to_account_id] || 0) + amt(t)
  })
  D.loans.forEach((l) => { m[l.account_id] = (m[l.account_id] || 0) + (l.kind === 'pago' ? amt(l) : -amt(l)) })
  return m
}

// Saldo de cada apartado. Si se pasa `before`, solo cuenta movimientos con fecha anterior.
export function envelopeStats(D, before) {
  const s = {}
  D.envelopes.forEach((e) => { s[e.id] = { allocated: 0, spent: 0, lent: 0, balance: 0 } })
  const ok = (d) => !before || d < before
  D.allocations.forEach((a) => { if (s[a.envelope_id] && ok(a.date)) s[a.envelope_id].allocated += amt(a) })
  D.transactions.forEach((t) => { if (t.kind === 'expense' && s[t.envelope_id] && ok(t.date)) s[t.envelope_id].spent += amt(t) })
  D.loans.forEach((l) => { if (l.kind === 'prestamo' && s[l.envelope_id] && ok(l.date)) s[l.envelope_id].lent += amt(l) })
  Object.values(s).forEach((x) => { x.balance = r2(x.allocated - x.spent - x.lent) })
  return s
}

// Solo los apartados con saldo cuentan para "dinero sin destino" (los pagos recurrentes salen directo de la cuenta).
const HOLDS_BALANCE = new Set(['personal', 'goal', 'savings', 'investment'])

export function totals(D) {
  const bal = accountBalances(D)
  const env = envelopeStats(D)
  const accounts = r2(Object.values(bal).reduce((a, b) => a + b, 0))
  const enveloped = r2(D.envelopes.filter((e) => HOLDS_BALANCE.has(e.kind)).reduce((a, e) => a + (env[e.id]?.balance || 0), 0))
  return { bal, env, accounts, enveloped, unassigned: r2(accounts - enveloped) }
}

export function debtInfo(e, D) {
  if (!e.debt_total) return null
  const paid = Number(e.debt_paid_before) + D.transactions.filter((t) => t.envelope_id === e.id && t.kind === 'expense').reduce((s, t) => s + amt(t), 0)
  return { total: Number(e.debt_total), paid, remaining: Math.max(0, r2(Number(e.debt_total) - paid)) }
}

export function receivables(D) {
  const byPerson = {}
  D.loans.forEach((l) => { byPerson[l.person_id] = (byPerson[l.person_id] || 0) + (l.kind === 'prestamo' ? amt(l) : -amt(l)) })
  return r2(Object.values(byPerson).reduce((a, v) => a + Math.max(0, v), 0))
}

export function netWorth(D) {
  const t = totals(D)
  const debts = r2(D.envelopes.filter((e) => e.kind === 'debt' && !e.archived).reduce((s, e) => s + (debtInfo(e, D)?.remaining || 0), 0))
  const owed = receivables(D)
  return { accounts: t.accounts, owed, debts, total: r2(t.accounts + owed - debts), unassigned: t.unassigned }
}

export const allocatedIn = (D, envId, month) =>
  r2(D.allocations.filter((a) => a.envelope_id === envId && monthKey(a.date) === month).reduce((s, a) => s + amt(a), 0))
export const spentIn = (D, envId, month) =>
  r2(D.transactions.filter((t) => t.envelope_id === envId && t.kind === 'expense' && monthKey(t.date) === month).reduce((s, t) => s + amt(t), 0))

// Cuánto conviene abonar a una meta este mes.
// Se usa el saldo al INICIO del mes, así la cuota no cambia si llegan varios ingresos.
export function neededFor(e, D, month, statsNow, statsBefore) {
  const monthly = Number(e.monthly_amount) || 0
  const target = Number(e.target_amount) || 0
  if (!target) return monthly
  const start = statsBefore[e.id]?.balance || 0
  const remaining = target - start
  if (remaining <= 0) return 0
  if (!e.target_date) return Math.min(monthly, remaining)
  const [y, m] = month.split('-').map(Number)
  const d = new Date(e.target_date + 'T00:00')
  const left = Math.max(1, (d.getFullYear() - y) * 12 + (d.getMonth() + 1 - m) + 1)
  return Math.ceil(remaining / left)
}

// Pagos recurrentes de un mes (checklist de "Mis pagos")
export function paymentsOf(D, month) {
  return D.envelopes
    .filter((e) => !e.archived && (e.kind === 'fixed' || e.kind === 'debt') && Number(e.monthly_amount) > 0)
    .map((e) => {
      const info = debtInfo(e, D)
      const need = e.kind === 'debt' && info ? Math.min(Number(e.monthly_amount), info.remaining) : Number(e.monthly_amount)
      const paid = spentIn(D, e.id, month)
      return { e, need, paid, remaining: Math.max(0, r2(need - paid)), done: cents(paid) >= cents(need) }
    })
    .sort((a, b) => (a.e.due_day || 99) - (b.e.due_day || 99) || a.e.name.localeCompare(b.e.name))
}

// Cuánto le queda por prestar a una persona este mes
export function loanRoom(D, personId, month, limit) {
  const lent = D.loans.filter((l) => l.person_id === personId && l.kind === 'prestamo' && monthKey(l.date) === month).reduce((s, l) => s + amt(l), 0)
  return { lent, room: Math.max(0, r2(Number(limit) - lent)) }
}

// Movimientos de un apartado (para mostrar historial)
export function ledgerOf(D, envId) {
  const src = (id) => D.income_sources.find((s) => s.id === id)?.name
  const acc = (id) => D.accounts.find((a) => a.id === id)?.name
  const out = []
  const incomeById = Object.fromEntries(D.incomes.map((i) => [i.id, i]))
  D.allocations.filter((a) => a.envelope_id === envId).forEach((a) => {
    const inc = a.income_id ? incomeById[a.income_id] : null
    const label = a.kind === 'income' ? `Aporte de ingreso${inc?.source_id ? ' · ' + src(inc.source_id) : ''}`
      : a.kind === 'unassigned' ? 'Dinero que ya tenía' : (a.note || 'Movimiento entre apartados')
    out.push({ id: a.id, date: a.date, label, amount: amt(a), del: a.kind === 'income' ? null : 'allocations' })
  })
  D.transactions.filter((t) => t.envelope_id === envId && t.kind === 'expense').forEach((t) => {
    out.push({ id: t.id, date: t.date, label: t.note || 'Gasto', sub: acc(t.account_id), amount: -amt(t), del: 'transactions', raw: t })
  })
  D.loans.filter((l) => l.envelope_id === envId && l.kind === 'prestamo').forEach((l) => {
    out.push({ id: l.id, date: l.date, label: 'Préstamo', amount: -amt(l), del: null })
  })
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
