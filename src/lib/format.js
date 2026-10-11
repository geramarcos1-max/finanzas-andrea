const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fmt0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export const mxn = (n) => fmt.format(Number(n) || 0)
export const mxn0 = (n) => fmt0.format(Number(n) || 0)
export const pct = (n) => `${(Number(n) || 0).toFixed(0)}%`

export const iso = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => iso(new Date())
export const monthKey = (s) => s.slice(0, 7)
export const monthFirst = (d = new Date()) => iso(new Date(d.getFullYear(), d.getMonth(), 1))
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)

export const fmtDate = (s) =>
  parse(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtMonth = (s) => {
  const t = parse(s.length === 7 ? s + '-01' : s).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const fmtMonthShort = (s) =>
  parse(s + '-01').toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')

export const PERIODS = [
  { key: 'month', label: 'Este mes' },
  { key: 'lastmonth', label: 'Mes pasado' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'year', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
]

export function periodRange(key, custom = {}) {
  const now = new Date()
  const t = iso(now)
  switch (key) {
    case 'lastmonth':
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case '30d': return { from: addDays(t, -29), to: t }
    case '3m': return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: t }
    case 'year': return { from: iso(new Date(now.getFullYear(), 0, 1)), to: t }
    case 'custom': return { from: custom.from || monthFirst(), to: custom.to || t }
    default: return { from: monthFirst(), to: t }
  }
}

// Período inmediatamente anterior con la misma duración
export function previousRange({ from, to }) {
  const len = diffDays(from, to) + 1
  return { from: addDays(from, -len), to: addDays(from, -1) }
}

export const CHART_COLORS = ['#0a84ff', '#34c759', '#ff9f0a', '#bf5af2', '#ff453a', '#64d2ff', '#ffd60a', '#ff6b9d', '#30b0c7', '#8e8e93']
