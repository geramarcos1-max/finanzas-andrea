// Toda la lógica de dinero vive aquí (funciones puras sobre los datos cargados).
import { monthKey } from './format'

export const cents = (n) => Math.round((Number(n) || 0) * 100)
export const r2 = (n) => cents(n) / 100
const amt = (x) => Number(x.amount) || 0

export const GROUPS = {
  obligations: 'Gastos fijos y deudas',
  emergency: 'Fondo de emergencia',
  personal: 'Gastos personales',
  goals: 'Metas de ahorro',
  longterm: 'Ahorro a largo plazo',
}
export const DEFAULT_PRIORITY = ['obligations', 'emergency', 'personal', 'goals', 'longterm']

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

// Saldo de cada sobre. Si se pasa `before`, solo cuenta movimientos con fecha anterior.
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

export function totals(D) {
  const bal = accountBalances(D)
  const env = envelopeStats(D)
  const accounts = r2(Object.values(bal).reduce((a, b) => a + b, 0))
  const enveloped = r2(Object.values(env).reduce((a, b) => a + b.balance, 0))
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

// Cuánto hay que apartar en `month` para este sobre.
// Para metas se usa el saldo al INICIO del mes, así la cuota no se mueve al llegar más ingresos.
export function neededFor(e, D, month, statsNow, statsBefore) {
  const monthly = Number(e.monthly_amount) || 0
  if (e.kind === 'goal') {
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
  if (e.kind === 'emergency' && e.target_amount && (statsNow[e.id]?.balance || 0) >= Number(e.target_amount)) return 0
  if (e.kind === 'debt') {
    const info = debtInfo(e, D)
    if (info) return Math.min(monthly, info.remaining)
  }
  return monthly
}

// Propuesta de reparto: respeta el orden de prioridades configurado.
export function propose(D, settings, amount, date) {
  const month = monthKey(date)
  const now = envelopeStats(D)
  const before = envelopeStats(D, month + '-01')
  const priority = [...(settings.priority || []), ...DEFAULT_PRIORITY].filter((g, i, a) => a.indexOf(g) === i)
  let rest = r2(amount)
  const lines = []
  const active = D.envelopes.filter((e) => !e.archived)

  const take = (group, e, need) => {
    const falta = Math.max(0, r2(need - allocatedIn(D, e.id, month)))
    const v = Math.min(rest, falta)
    rest = r2(rest - v)
    lines.push({ group, envelope_id: e.id, name: e.name, amount: v, falta })
  }
  const byDay = (a, b) => (a.due_day || 99) - (b.due_day || 99) || a.name.localeCompare(b.name)
  const byDate = (a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999')

  const handlers = {
    obligations: () => active.filter((e) => e.kind === 'fixed' || e.kind === 'debt').sort(byDay)
      .forEach((e) => take('obligations', e, neededFor(e, D, month, now, before))),
    emergency: () => active.filter((e) => e.kind === 'emergency').forEach((e) => take('emergency', e, neededFor(e, D, month, now, before))),
    personal: () => active.filter((e) => e.kind === 'personal').forEach((e) => take('personal', e, neededFor(e, D, month, now, before))),
    goals: () => active.filter((e) => e.kind === 'goal').sort(byDate)
      .forEach((e) => { const n = neededFor(e, D, month, now, before); if (n > 0) take('goals', e, n) }),
    longterm: () => active.filter((e) => e.kind === 'longterm').forEach((e) => {
      const v = Math.min(rest, r2((amount * (Number(settings.longterm_pct) || 0)) / 100))
      rest = r2(rest - v)
      lines.push({ group: 'longterm', envelope_id: e.id, name: e.name, amount: v, falta: 0 })
    }),
  }
  priority.forEach((g) => handlers[g]?.())

  // Lo que sobre va a largo plazo
  const lt = lines.find((l) => l.group === 'longterm') || (() => {
    const e = active.find((x) => x.kind === 'longterm')
    if (!e) return null
    const l = { group: 'longterm', envelope_id: e.id, name: e.name, amount: 0, falta: 0 }
    lines.push(l); return l
  })()
  if (lt) { lt.amount = r2(lt.amount + rest); lt.leftover = true }
  return lines
}

// Movimientos de un sobre (para mostrar historial)
export function ledgerOf(D, envId) {
  const src = (id) => D.income_sources.find((s) => s.id === id)?.name
  const acc = (id) => D.accounts.find((a) => a.id === id)?.name
  const out = []
  const incomeById = Object.fromEntries(D.incomes.map((i) => [i.id, i]))
  D.allocations.filter((a) => a.envelope_id === envId).forEach((a) => {
    const inc = a.income_id ? incomeById[a.income_id] : null
    const label = a.kind === 'income' ? `Aporte de ingreso${inc?.source_id ? ' · ' + src(inc.source_id) : ''}`
      : a.kind === 'unassigned' ? 'Asignado de saldo disponible' : (a.note || 'Movimiento entre sobres')
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
