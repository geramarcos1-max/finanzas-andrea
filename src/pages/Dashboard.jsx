import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar as RBar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useData } from '../lib/DataContext'
import { allocatedIn, debtInfo, netWorth, neededFor, envelopeStats, r2, spentIn, totals } from '../lib/calc'
import {
  PERIODS, addDays, diffDays, fmtDate, fmtMonthShort, iso, monthFirst, monthKey, mxn, mxn0, pct, periodRange, previousRange, today,
} from '../lib/format'
import { Bar, Empty, Group, Item, Kpi, PageHead, Pill, pctChange } from '../ui'

const COLORS = ['#6B5E4E', '#4F7A5A', '#A7742B', '#8E7BA8', '#A6493F', '#5E8CA6', '#C9B9A3', '#B58BA0', '#7C9A8B', '#8A857E']
const sumA = (arr) => arr.reduce((s, x) => s + Number(x.amount), 0)

function Delta({ cur, prev, invert }) {
  const d = pctChange(cur, prev)
  if (d === null || !isFinite(d)) return null
  const good = invert ? d <= 0 : d >= 0
  return <span className={good ? 'good-t' : 'bad-t'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% vs. período anterior</span>
}

export default function Dashboard({ ctx }) {
  const D = useData()
  const nav = useNavigate()
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ from: monthFirst(), to: today() })
  const [acc, setAcc] = useState('')
  const [compare, setCompare] = useState(true)

  const t0 = today()
  const MES = t0.slice(0, 7)
  const range = periodRange(period, custom)
  const prev = previousRange(range)
  const T = totals(D)
  const NW = netWorth(D)

  const m = useMemo(() => {
    const inR = (x, r) => x.date >= r.from && x.date <= r.to
    const incs = D.incomes.filter((i) => i.type === 'income' && (!acc || i.account_id === acc))
    const exps = D.transactions.filter((x) => x.kind === 'expense' && (!acc || x.account_id === acc))
    const cur = { i: incs.filter((x) => inR(x, range)), e: exps.filter((x) => inR(x, range)) }
    const pre = { i: incs.filter((x) => inR(x, prev)), e: exps.filter((x) => inR(x, prev)) }
    const lastDay = range.to < t0 ? range.to : t0
    const days = Math.max(1, diffDays(range.from, lastDay) + 1)
    const prevDays = Math.max(1, diffDays(prev.from, prev.to) + 1)

    const line = []
    let a = 0, b = 0
    for (let i = 0; i < days; i++) {
      const d1 = addDays(range.from, i), d2 = addDays(prev.from, i)
      a += sumA(cur.e.filter((x) => x.date === d1))
      b += sumA(pre.e.filter((x) => x.date === d2))
      line.push({ dia: i + 1, Actual: a, Anterior: b })
    }

    const now = new Date()
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const k = iso(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7)
      monthly.push({ mes: fmtMonthShort(k), Ingresos: sumA(incs.filter((x) => monthKey(x.date) === k)), Gastos: sumA(exps.filter((x) => monthKey(x.date) === k)) })
    }

    const byCat = {}
    cur.e.forEach((x) => {
      const c = D.categories.find((k) => k.id === x.category_id)
      const e = D.envelopes.find((k) => k.id === x.envelope_id)
      const name = c ? c.name : e ? e.name : 'Sin categoría'
      byCat[name] = (byCat[name] || 0) + Number(x.amount)
    })
    const cats = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value)
    return { inc: sumA(cur.i), exp: sumA(cur.e), pInc: sumA(pre.i), pExp: sumA(pre.e), days, prevDays, line, monthly, cats }
  }, [D.incomes, D.transactions, D.categories, D.envelopes, acc, range.from, range.to])

  const savings = m.inc - m.exp

  // Estado del mes en curso
  const active = D.envelopes.filter((e) => !e.archived)
  const personal = active.find((e) => e.kind === 'personal')
  const emergency = active.find((e) => e.kind === 'emergency')
  const longterm = active.find((e) => e.kind === 'longterm')
  const bills = active.filter((e) => e.kind === 'fixed' || e.kind === 'debt')
  const paidCount = bills.filter((e) => spentIn(D, e.id, MES) >= (Number(e.monthly_amount) || 0) - 0.005 && Number(e.monthly_amount) > 0).length
  const goals = active.filter((e) => e.kind === 'goal')
  const debts = bills.filter((e) => e.kind === 'debt')

  const now = envelopeStats(D)
  const before = envelopeStats(D, MES + '-01')
  const needTotal = active.filter((e) => e.kind !== 'longterm').reduce((s, e) => s + neededFor(e, D, MES, now, before), 0)
  const fundedTotal = active.filter((e) => e.kind !== 'longterm').reduce((s, e) => s + Math.min(allocatedIn(D, e.id, MES), neededFor(e, D, MES, now, before)), 0)

  const steps = [
    { done: D.accounts.length > 0, text: 'Crea tus cuentas (banco, efectivo) con su saldo actual', to: '/cuentas' },
    { done: bills.filter((e) => e.kind === 'fixed').length > 0, text: 'Agrega tus gastos fijos (renta, servicios, celular…)', to: '/fijos' },
    { done: D.incomes.length > 0 || T.enveloped > 0, text: 'Registra tu primer ingreso para repartirlo', action: ctx.openIncome },
  ]
  const onboarding = steps.some((s) => !s.done) && D.incomes.length === 0

  return (
    <>
      <PageHead title="Hola, Andrea" sub="Así va tu mes. Cada vez que recibas un ingreso, regístralo y el sistema te propone cómo repartirlo.">
        <button className="btn pri" onClick={ctx.openIncome}>+ Registrar ingreso</button>
      </PageHead>

      {onboarding && (
        <div className="card" style={{ marginBottom: 20 }}>
          <b>Para empezar</b>
          <div className="list" style={{ marginTop: 8 }}>
            {steps.map((s, i) => (
              <Item key={i} title={`${s.done ? '✅' : '⬜'}  ${s.text}`}
                onClick={() => (s.to ? nav(s.to) : s.action())} />
            ))}
          </div>
        </div>
      )}

      {T.unassigned > 0.5 && (
        <div className="callout warn" style={{ marginBottom: 16 }}>
          Tienes <b>{mxn(T.unassigned)}</b> en tus cuentas que aún no están apartados en ningún sobre.{' '}
          <button className="link" onClick={ctx.openAssign}>Asignarlos ahora</button>
        </div>
      )}
      {T.unassigned < -0.5 && (
        <div className="callout bad" style={{ marginBottom: 16 }}>
          Tus sobres suman <b>{mxn(-T.unassigned)}</b> más de lo que hay en tus cuentas. Revisa los saldos de <Link to="/cuentas">Cuentas</Link> o un gasto sin registrar.
        </div>
      )}

      <div className="kpis">
        <Kpi label="Patrimonio neto" value={mxn0(NW.total)} hint={`Cuentas ${mxn0(NW.accounts)} · Por cobrar ${mxn0(NW.owed)} · Deudas −${mxn0(NW.debts)}`} onClick={() => nav('/cuentas')} />
        <Kpi label="Disponible para ti" value={mxn0(personal ? now[personal.id]?.balance : 0)}
          tone={personal && now[personal.id]?.balance < 0 ? 'bad' : ''}
          hint={`Gastado este mes ${mxn0(personal ? spentIn(D, personal.id, MES) : 0)}`} onClick={() => nav('/personales')} />
        <Kpi label="Pagos del mes" value={`${paidCount} de ${bills.filter((e) => Number(e.monthly_amount) > 0).length}`} hint="Gastos fijos y deudas pagados" onClick={() => nav('/pagos')} />
        <Kpi label="Reparto del mes" value={`${pct(needTotal ? (fundedTotal / needTotal) * 100 : 0)}`} hint={`Apartado ${mxn0(fundedTotal)} de ${mxn0(needTotal)}`} />
        <Kpi label="Fondo de emergencia" value={mxn0(emergency ? now[emergency.id]?.balance : 0)}
          hint={emergency?.target_amount ? `${pct(((now[emergency.id]?.balance || 0) / emergency.target_amount) * 100)} de ${mxn0(emergency.target_amount)}` : `${mxn0(emergency?.monthly_amount || 0)} al mes`} onClick={() => nav('/emergencia')} />
        <Kpi label="Ahorro a largo plazo" value={mxn0(longterm ? now[longterm.id]?.balance : 0)} hint={`${D.settings.longterm_pct}% de cada ingreso + lo que sobre`} onClick={() => nav('/largo-plazo')} />
      </div>

      <h2>Análisis</h2>
      <div className="filters">
        <label className="f">Período
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
        </label>
        {period === 'custom' && (
          <>
            <label className="f">Desde<input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label className="f">Hasta<input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </>
        )}
        <label className="f">Cuenta
          <select value={acc} onChange={(e) => setAcc(e.target.value)}>
            <option value="">Todas</option>
            {D.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <div className="f">Comparar<div className="seg">
          <button className={compare ? 'on' : ''} onClick={() => setCompare(true)}>Sí</button>
          <button className={!compare ? 'on' : ''} onClick={() => setCompare(false)}>No</button>
        </div></div>
      </div>

      <div className="kpis">
        <Kpi label="Ingresos" value={mxn0(m.inc)} hint={compare ? <Delta cur={m.inc} prev={m.pInc} /> : null} />
        <Kpi label="Gastos" value={mxn0(m.exp)} hint={compare ? <Delta cur={m.exp} prev={m.pExp} invert /> : null} />
        <Kpi label="Ahorro del período" value={mxn0(savings)} tone={savings < 0 ? 'bad' : ''}
          hint={m.inc > 0 ? `Tasa de ahorro ${pct((savings / m.inc) * 100)}` : null} />
        <Kpi label="Gasto promedio al día" value={mxn0(m.exp / m.days)} hint={compare ? <Delta cur={m.exp / m.days} prev={m.pExp / m.prevDays} invert /> : null} />
        <Kpi label="Ingreso promedio al día" value={mxn0(m.inc / m.days)} hint={compare ? <Delta cur={m.inc / m.days} prev={m.pInc / m.prevDays} /> : null} />
      </div>

      <div className="split" style={{ marginTop: 20 }}>
        <div>
          <h2>Ingresos vs. gastos (6 meses)</h2>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={m.monthly} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => mxn(v)} />
              <Legend />
              <RBar dataKey="Ingresos" fill="#4F7A5A" radius={[5, 5, 0, 0]} />
              <RBar dataKey="Gastos" fill="#A6493F" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h2>Gasto acumulado por día</h2>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={m.line}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => mxn(v)} labelFormatter={(d) => `Día ${d}`} />
              <Legend />
              <Line type="monotone" dataKey="Actual" stroke="#6B5E4E" strokeWidth={2.5} dot={false} />
              {compare && <Line type="monotone" dataKey="Anterior" stroke="#B8B2A9" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="split">
        <div>
          <h2>Gastos por categoría</h2>
          {m.cats.length === 0 ? <Empty>Sin gastos en este período.</Empty> : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 170, height: 170 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={m.cats} dataKey="value" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                      {m.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => mxn(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 170 }}>
                {m.cats.slice(0, 7).map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 9, background: COLORS[i % COLORS.length] }} />
                    <span style={{ flex: 1 }} className="note">{c.name}</span>
                    <span className="num">{mxn0(c.value)}</span>
                    <span className="note" style={{ width: 34, textAlign: 'right' }}>{pct((c.value / m.exp) * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <h2>Ahorros con meta</h2>
          {goals.length === 0 ? <Empty>Aún no tienes metas. <Link to="/metas">Crear una</Link></Empty> : (
            <div className="list">
              {goals.map((g) => {
                const bal = now[g.id]?.balance || 0
                return (
                  <Item key={g.id} title={g.name} sub={g.target_date ? `Límite: ${fmtDate(g.target_date)}` : null}
                    right={g.target_amount ? pct((bal / g.target_amount) * 100) : mxn0(bal)} onClick={() => nav('/metas')}>
                    {g.target_amount && <div style={{ marginTop: 6 }}><Bar value={bal} max={Number(g.target_amount)} tone="good" /></div>}
                  </Item>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {debts.length > 0 && (
        <>
          <h2>Deudas</h2>
          <div className="list">
            {debts.map((d) => {
              const info = debtInfo(d, D)
              return (
                <Item key={d.id} title={d.name} sub={`Mensualidad ${mxn0(d.monthly_amount)}${d.due_day ? ` · día ${d.due_day}` : ''}`}
                  right={info ? mxn0(info.remaining) : '—'} rightSub={info ? 'pendiente' : 'sin saldo total'} onClick={() => nav('/fijos')}>
                  {info && <div style={{ marginTop: 6 }}><Bar value={info.paid} max={info.total} tone="good" /></div>}
                </Item>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
