import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar as RBar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { computeNetWorth, useData } from '../lib/DataContext'
import {
  CHART_COLORS, PERIODS, addDays, diffDays, fmtDate, fmtMonthShort, iso, monthFirst, monthKey,
  mxn, mxn0, parse, pct, periodRange, previousRange, today,
} from '../lib/format'
import { Bar as Progress, Empty, Kpi, pctChange } from '../ui'

const sumKind = (arr, kind) => arr.filter((t) => t.kind === kind).reduce((s, t) => s + Number(t.amount), 0)

export default function Dashboard() {
  const D = useData()
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ from: monthFirst(), to: today() })
  const [acc, setAcc] = useState('')
  const [cat, setCat] = useState('')
  const [compare, setCompare] = useState(true)

  const range = periodRange(period, custom)
  const prev = previousRange(range)
  const t0 = today()

  const m = useMemo(() => {
    const base = D.transactions.filter((t) => t.kind !== 'transfer' && (!acc || t.account_id === acc) && (!cat || t.category_id === cat))
    const inR = (t, r) => t.date >= r.from && t.date <= r.to
    const cur = base.filter((t) => inR(t, range))
    const pre = base.filter((t) => inR(t, prev))
    const lastDay = range.to < t0 ? range.to : t0
    const days = Math.max(1, diffDays(range.from, lastDay) + 1)
    const prevDays = Math.max(1, diffDays(prev.from, prev.to) + 1)
    const inc = sumKind(cur, 'income'), exp = sumKind(cur, 'expense')
    const pInc = sumKind(pre, 'income'), pExp = sumKind(pre, 'expense')

    // acumulado diario de gasto
    const len = Math.max(1, diffDays(range.from, lastDay) + 1)
    const line = []
    let a = 0, b = 0
    for (let i = 0; i < len; i++) {
      const d1 = addDays(range.from, i), d2 = addDays(prev.from, i)
      a += cur.filter((t) => t.kind === 'expense' && t.date === d1).reduce((s, t) => s + Number(t.amount), 0)
      b += pre.filter((t) => t.kind === 'expense' && t.date === d2).reduce((s, t) => s + Number(t.amount), 0)
      line.push({ dia: i + 1, Actual: a, Anterior: b })
    }

    // últimos 6 meses
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) months.push(iso(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7))
    const monthly = months.map((k) => {
      const ts = base.filter((t) => monthKey(t.date) === k)
      return { mes: fmtMonthShort(k), Ingresos: sumKind(ts, 'income'), Gastos: sumKind(ts, 'expense') }
    })

    // gasto por categoría
    const byCat = {}
    cur.filter((t) => t.kind === 'expense').forEach((t) => {
      const c = D.categories.find((x) => x.id === t.category_id)
      const name = c ? c.name : 'Sin categoría'
      byCat[name] = (byCat[name] || 0) + Number(t.amount)
    })
    const cats = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value)

    return { inc, exp, pInc, pExp, days, prevDays, line, monthly, cats }
  }, [D.transactions, D.categories, acc, cat, range.from, range.to])

  const nw = computeNetWorth(D)
  const savings = m.inc - m.exp
  const savingsRate = m.inc > 0 ? (savings / m.inc) * 100 : 0

  // presupuesto del mes en curso
  const mk = monthFirst()
  const budgetRows = D.budgets
    .filter((b) => b.month === mk)
    .map((b) => {
      const c = D.categories.find((x) => x.id === b.category_id)
      const spent = D.transactions
        .filter((t) => t.kind === 'expense' && t.category_id === b.category_id && monthKey(t.date) === mk.slice(0, 7))
        .reduce((s, t) => s + Number(t.amount), 0)
      return { id: b.id, name: c?.name || '—', budget: Number(b.amount), spent }
    })
    .sort((x, y) => y.spent / (y.budget || 1) - x.spent / (x.budget || 1))
    .slice(0, 6)

  // recurrentes pendientes este mes
  const pending = D.recurring.filter(
    (r) => r.active && !D.transactions.some((t) => t.recurring_id === r.id && monthKey(t.date) === mk.slice(0, 7))
  )

  async function registerRecurring(r) {
    if (!r.account_id) { alert('Asigna una cuenta a este movimiento recurrente en Ajustes.'); return }
    const { error } = await supabase.from('transactions').insert({
      date: t0, kind: r.kind, amount: r.amount, account_id: r.account_id,
      category_id: r.category_id, debt_id: r.debt_id, note: r.name, recurring_id: r.id,
    })
    if (error) alert(error.message); else D.reload()
  }

  const activeDebts = D.debts.filter((d) => !d.archived)
  const activeGoals = D.goals.filter((g) => !g.completed)
  const empty = D.accounts.length === 0

  return (
    <>
      <div className="page-head">
        <h1>Resumen</h1>
        <div className="filters">
          <div>
            <label>Período</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div><label>Desde</label><input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
              <div><label>Hasta</label><input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
            </>
          )}
          <div>
            <label>Cuenta</label>
            <select value={acc} onChange={(e) => setAcc(e.target.value)}>
              <option value="">Todas</option>
              {D.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label>Categoría</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas</option>
              {D.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Comparar</label>
            <div className="seg">
              <button className={compare ? 'on' : ''} onClick={() => setCompare(true)}>Sí</button>
              <button className={!compare ? 'on' : ''} onClick={() => setCompare(false)}>No</button>
            </div>
          </div>
        </div>
      </div>

      {empty && (
        <div className="banner">
          <b>¡Bienvenida! 👋</b> Empieza creando tus cuentas (banco, efectivo) en <Link to="/patrimonio">Patrimonio</Link>,
          luego registra tus movimientos en <Link to="/movimientos">Movimientos</Link>.
        </div>
      )}

      {pending.length > 0 && (
        <div className="banner">
          <b>Pendientes de registrar este mes</b>
          <div className="list" style={{ marginTop: 6 }}>
            {pending.map((r) => (
              <div className="row" key={r.id} style={{ borderColor: '#d6e4ff' }}>
                <div className="grow"><div className="title">{r.name}</div><div className="small muted">Día {r.day_of_month} · {r.kind === 'income' ? 'Ingreso' : 'Gasto'}</div></div>
                <span className="amount">{mxn(r.amount)}</span>
                <button className="btn sm" onClick={() => registerRecurring(r)}>Registrar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid kpis">
        <Kpi hero title="Patrimonio neto" value={mxn0(nw.total)} sub={`Cuentas ${mxn0(nw.cash)} · Inversiones ${mxn0(nw.inv)} · Deudas −${mxn0(nw.debt)}`} />
        <Kpi title="Ingresos" value={mxn0(m.inc)} delta={compare ? pctChange(m.inc, m.pInc) : null} />
        <Kpi title="Gastos" value={mxn0(m.exp)} invert delta={compare ? pctChange(m.exp, m.pExp) : null} />
        <Kpi title="Ahorro del período" value={mxn0(savings)} sub={`Tasa de ahorro ${pct(savingsRate)}`} delta={compare ? pctChange(savings, m.pInc - m.pExp) : null} />
        <Kpi title="Gasto promedio al día" value={mxn0(m.exp / m.days)} invert delta={compare ? pctChange(m.exp / m.days, m.pExp / m.prevDays) : null} />
        <Kpi title="Ingreso promedio al día" value={mxn0(m.inc / m.days)} delta={compare ? pctChange(m.inc / m.days, m.pInc / m.prevDays) : null} />
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Ingresos vs. gastos (6 meses)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={m.monthly} barGap={4}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => mxn(v)} />
              <Legend />
              <RBar dataKey="Ingresos" fill="#30a46c" radius={[6, 6, 0, 0]} />
              <RBar dataKey="Gastos" fill="#e5484d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Gasto acumulado por día</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={m.line}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => mxn(v)} labelFormatter={(d) => `Día ${d}`} />
              <Legend />
              <Line type="monotone" dataKey="Actual" stroke="#0a84ff" strokeWidth={2.5} dot={false} />
              {compare && <Line type="monotone" dataKey="Anterior" stroke="#aeaeb2" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Gastos por categoría</h2>
          {m.cats.length === 0 ? <Empty>Sin gastos en este período.</Empty> : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 180, height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={m.cats} dataKey="value" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                      {m.cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => mxn(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="list" style={{ flex: 1, minWidth: 180 }}>
                {m.cats.slice(0, 7).map((c, i) => (
                  <div className="row" key={c.name} style={{ padding: '6px 0' }}>
                    <span className="dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="grow small">{c.name}</span>
                    <span className="amount small">{mxn0(c.value)}</span>
                    <span className="small muted" style={{ width: 36, textAlign: 'right' }}>{pct((c.value / m.exp) * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Presupuesto de {parse(mk).toLocaleDateString('es-MX', { month: 'long' })}</h2>
          {budgetRows.length === 0 ? (
            <Empty>Aún no defines presupuestos. <Link to="/presupuestos">Crear presupuesto</Link></Empty>
          ) : (
            <div className="stack">
              {budgetRows.map((b) => {
                const r = b.budget ? b.spent / b.budget : 0
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small">
                      <span>{b.name}</span><span className="muted">{mxn0(b.spent)} / {mxn0(b.budget)}</span>
                    </div>
                    <Progress value={b.spent} max={b.budget} tone={r > 1 ? 'over' : r > 0.8 ? 'warn' : 'ok'} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Deudas</h2>
          {activeDebts.length === 0 ? <Empty>Sin deudas registradas.</Empty> : (
            <div className="stack">
              {activeDebts.map((d) => (
                <div key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{d.name}</b><span className="amount">{mxn0(d.remaining)}</span>
                  </div>
                  <Progress value={Number(d.total_paid)} max={Number(d.original_amount)} />
                  <div className="small muted">Pagado {mxn0(d.total_paid)} de {mxn0(d.original_amount)}{d.monthly_payment ? ` · Mensualidad ${mxn0(d.monthly_payment)}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Metas</h2>
          {activeGoals.length === 0 ? <Empty>Aún no tienes metas. <Link to="/metas">Crear una meta</Link></Empty> : (
            <div className="stack">
              {activeGoals.slice(0, 4).map((g) => (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{g.name}</b><span className="small muted">{mxn0(g.saved)} / {mxn0(g.target_amount)}</span>
                  </div>
                  <Progress value={Number(g.saved)} max={Number(g.target_amount)} tone="ok" />
                  {g.target_date && <div className="small muted">Meta: {fmtDate(g.target_date)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
