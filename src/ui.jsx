import { mxn } from './lib/format'

export function Bar({ value, max, tone }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return <div className={`bar ${tone || ''}`}><i style={{ width: `${p}%` }} /></div>
}

export function Kpi({ title, value, sub, delta, invert, hero }) {
  // delta: variación % vs período anterior. invert=true => subir es malo (gastos)
  let cls = 'muted', txt = null
  if (delta !== undefined && delta !== null && isFinite(delta)) {
    const good = invert ? delta <= 0 : delta >= 0
    cls = good ? 'pos' : 'neg'
    txt = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}% vs. período anterior`
  }
  return (
    <div className={`card kpi ${hero ? 'hero' : ''}`}>
      <h3>{title}</h3>
      <div className="value">{value}</div>
      {txt && <div className={`delta ${hero ? '' : cls}`}>{txt}</div>}
      {sub && <div className="delta muted">{sub}</div>}
    </div>
  )
}

export const Empty = ({ children }) => <div className="empty">{children}</div>
export const Money = ({ v, signed }) => (
  <span className={`amount ${signed ? (v >= 0 ? 'pos' : 'neg') : ''}`}>{mxn(v)}</span>
)
export const ErrorMsg = ({ msg }) => (msg ? <div className="error">{msg}</div> : null)

export const pctChange = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null)
