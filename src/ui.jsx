import { useEffect, useState } from 'react'
import { mxn } from './lib/format'

// ---------- avisos ----------
let setToast
export const toast = (m) => setToast && setToast(m)
export function Toaster() {
  const [m, s] = useState('')
  setToast = s
  useEffect(() => {
    if (!m) return
    const t = setTimeout(() => s(''), 2600)
    return () => clearTimeout(t)
  }, [m])
  return m ? <div className="toast" role="status">{m}</div> : null
}

// Ejecuta una llamada a Supabase, avisa y recarga datos.
export async function run(promise, reload, ok) {
  const { error } = await promise
  if (error) { toast('⚠️ ' + error.message); return false }
  if (reload) await reload()
  if (ok) toast(ok)
  return true
}

// ---------- piezas visuales ----------
export function Bar({ value, max, tone }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return <div className={`bar ${tone || ''}`}><i style={{ width: `${p}%` }} /></div>
}
export const Pill = ({ tone, children }) => <span className={`pill ${tone || ''}`}>{children}</span>
export const PageHead = ({ title, sub, children }) => (
  <div className="head">
    <div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
    {children && <div className="row">{children}</div>}
  </div>
)
export function Kpi({ label, value, hint, tone, onClick }) {
  return (
    <div className={`kpi ${onClick ? 'click' : ''}`} onClick={onClick}>
      <div className="l">{label}</div>
      <div className={`v num ${tone ? tone + '-t' : ''}`}>{value}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  )
}
export const Empty = ({ children }) => <div className="emptybox">{children}</div>
export const Group = ({ children }) => <div className="grp">{children}</div>
export const Money = ({ v, tone }) => <span className={`num ${tone ? tone + '-t' : ''}`}>{mxn(v)}</span>

export function Item({ title, sub, right, rightSub, actions, onClick, children }) {
  return (
    <div className={`item ${onClick ? 'click' : ''}`} onClick={onClick}>
      <div className="main">
        <div className="t">{title}</div>
        {sub && <div className="note">{sub}</div>}
        {children}
      </div>
      {(right !== undefined || rightSub) && (
        <div className="r">
          {right !== undefined && <div className="num" style={{ fontWeight: 600 }}>{right}</div>}
          {rightSub && <div className="note">{rightSub}</div>}
        </div>
      )}
      {actions && <div className="acts" onClick={(e) => e.stopPropagation()}>{actions}</div>}
    </div>
  )
}

export function Modal({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        {title && <h3>{title}</h3>}
        {sub && <p className="note" style={{ margin: '0 0 8px' }}>{sub}</p>}
        {children}
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- campos ----------
const fmtRaw = (raw) => {
  if (raw === '' || raw == null) return ''
  const s = String(raw)
  const sign = s.startsWith('-') ? '-' : ''
  const [i, d] = s.replace('-', '').split('.')
  return sign + (i ? Number(i).toLocaleString('en-US') : sign ? '' : '0') + (d !== undefined ? '.' + d : '')
}
// Campo de dinero con comas de miles (1,000 · 10,000 · 100,000). `signed` permite negativos.
export function MoneyInput({ value, onChange, signed, ...rest }) {
  return (
    <input
      inputMode={signed ? 'text' : 'decimal'}
      autoComplete="off"
      {...rest}
      value={fmtRaw(value)}
      onChange={(e) => {
        const neg = signed && e.target.value.trim().startsWith('-')
        let raw = e.target.value.replace(/[^0-9.]/g, '')
        const p = raw.split('.')
        if (p.length > 2) raw = p[0] + '.' + p.slice(1).join('')
        if (p[1] !== undefined) raw = p[0] + '.' + p[1].slice(0, 2)
        onChange((neg ? '-' : '') + raw)
      }}
    />
  )
}
export const toNum = (raw) => Number(String(raw ?? '').replace(/[^0-9.]/g, '')) || 0
export const toSigned = (raw) => {
  const s = String(raw ?? '')
  return (s.trim().startsWith('-') ? -1 : 1) * toNum(s)
}

export function Field({ label, children }) {
  return <label className="f">{label}{children}</label>
}

// Formulario genérico dentro de un modal.
// fields: [{key,label,type:'text'|'money'|'date'|'select'|'number', options:[{value,label}], required, placeholder, show(values)}]
export function FormModal({ title, sub, fields, initial = {}, onSave, onClose, onDelete, saveLabel = 'Guardar', children, extra }) {
  const [v, setV] = useState(() => {
    const o = {}
    fields.forEach((f) => { o[f.key] = initial[f.key] ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '') })
    return o
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }))

  async function submit(e) {
    e.preventDefault()
    for (const f of fields) {
      if (f.show && !f.show(v)) continue
      if (f.required && (v[f.key] === '' || v[f.key] == null)) return setErr(`Falta: ${f.label}`)
      if (f.required && f.type === 'money' && !f.signed && !(toNum(v[f.key]) > 0)) return setErr(`${f.label} debe ser mayor a 0`)
    }
    const out = {}
    fields.forEach((f) => { if (!f.show || f.show(v)) out[f.key] = f.type === 'money' ? (f.signed ? toSigned(v[f.key]) : toNum(v[f.key])) : v[f.key] })
    setBusy(true); setErr('')
    const res = await onSave(out)
    setBusy(false)
    if (typeof res === 'string') setErr(res)
    else onClose()
  }

  return (
    <Modal title={title} sub={sub} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form" style={{ padding: '10px 0' }}>
          {fields.map((f) => (f.show && !f.show(v) ? null : (
            <Field key={f.key} label={f.label}>
              {f.type === 'select' ? (
                <select value={v[f.key]} onChange={(e) => set(f.key)(e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'money' ? (
                <MoneyInput value={v[f.key]} onChange={set(f.key)} signed={f.signed} placeholder={f.placeholder || '0'} />
              ) : (
                <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={v[f.key]}
                  min={f.min} max={f.max} placeholder={f.placeholder} onChange={(e) => set(f.key)(e.target.value)} />
              )}
            </Field>
          )))}
        </div>
        {children}
        {extra}
        {err && <p className="note bad-t" role="alert">{err}</p>}
        <div className="foot">
          {onDelete ? <button type="button" className="link" onClick={() => { onClose(); onDelete() }}>Eliminar</button> : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn pri" disabled={busy}>{saveLabel}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export const confirmDel = (what) => window.confirm(`¿Eliminar ${what}? Esta acción no se puede deshacer.`)
export const opts = (arr, label = (x) => x.name, value = (x) => x.id) => arr.map((x) => ({ value: value(x), label: label(x) }))
export const pctChange = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null)
