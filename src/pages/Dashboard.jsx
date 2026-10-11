import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../lib/DataContext'
import { allocatedIn, paymentsOf, spentIn, totals } from '../lib/calc'
import { dueText, trafficLight } from '../lib/friendly'
import { mxn, mxn0, pct, today } from '../lib/format'
import { Bar } from '../ui'

export default function Home({ ctx }) {
  const D = useData()
  const nav = useNavigate()
  const T = totals(D)
  const MES = today().slice(0, 7)
  const day = new Date().getDate()
  const active = D.envelopes.filter((e) => !e.archived)
  const personal = active.find((e) => e.kind === 'personal')
  const savings = active.find((e) => e.kind === 'savings')
  const investment = active.find((e) => e.kind === 'investment')
  const goals = active.filter((e) => e.kind === 'goal')

  const left = personal ? T.env[personal.id]?.balance || 0 : 0
  const spent = personal ? spentIn(D, personal.id, MES) : 0
  const setAside = personal ? allocatedIn(D, personal.id, MES) : 0
  const reference = Math.max(setAside, left + spent)
  const light = trafficLight(left, reference)

  const moves = D.pending_moves.filter((m) => !m.done_at)
  const bills = paymentsOf(D, MES).filter((p) => !p.done)

  const todo = []
  if (moves.length) todo.push({ k: 'moves', icon: '🏦', title: 'Haz tus guardaditos en el banco', sub: `${moves.length} ${moves.length === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}`, tone: 'warn', go: ctx.openBank })
  if (T.unassigned > 0.5) todo.push({ k: 'un', icon: '💡', title: 'Tienes dinero sin destino', sub: `${mxn(T.unassigned)} · toca para decidir qué hacer con él`, tone: 'warn', go: ctx.openAssign })
  if (T.unassigned < -0.5) todo.push({ k: 'neg', icon: '⚠️', title: 'Algo no cuadra con tus cuentas', sub: `Tus destinos suman ${mxn(-T.unassigned)} más que tu dinero real. Revisa tus saldos en Mi dinero.`, tone: 'bad', go: () => nav('/cuentas') })
  D.category_budgets.forEach((b) => {
    const cat = D.categories.find((c) => c.id === b.category_id)
    const used = D.transactions.filter((t) => t.kind === 'expense' && t.category_id === b.category_id && t.date.startsWith(MES)).reduce((s, t) => s + Number(t.amount), 0)
    if (cat && Number(b.amount) > 0 && used > Number(b.amount)) {
      todo.push({ k: 'bud' + b.category_id, icon: '🧮', title: `Te pasaste en ${cat.name}`, sub: `Gastaste ${mxn(used)} de ${mxn(b.amount)} este mes`, tone: 'bad', go: () => nav('/presupuestos') })
    }
  })
  bills.slice(0, 4).forEach((b) => {
    const overdue = b.e.due_day && b.e.due_day < day
    todo.push({ k: b.e.id, icon: overdue ? '🔴' : '🗓️', title: b.e.name, sub: `${mxn(b.remaining)}${b.e.due_day ? ' · ' + dueText(b.e.due_day) : ''}`, tone: overdue ? 'bad' : '', go: () => nav('/pagos') })
  })

  const firstTime = D.accounts.length === 0

  return (
    <>
      <h1>Hola, Andrea 👋</h1>
      <p className="sub" style={{ marginBottom: 18 }}>{firstTime ? 'Vamos a empezar. Te toma 5 minutos.' : 'Así va tu dinero hoy.'}</p>

      {firstTime && (
        <div className="card start">
          <b>Empieza aquí</b>
          <ol>
            <li>Crea tu cuenta de banco con lo que tienes hoy → <Link to="/cuentas">Mi dinero</Link></li>
            <li>Agrega tus pagos de cada mes (renta, carro…) → <Link to="/pagos">Mis pagos</Link></li>
            <li>Cuando te llegue dinero, toca <b>“Me llegó dinero”</b> y yo te voy guiando.</li>
          </ol>
          <Link to="/guia" className="btn">📖 Ver cómo usar la app</Link>
        </div>
      )}

      <div className="card hero">
        <div className="note">Puedes gastar</div>
        <div className="huge num" style={{ color: light.tone ? `var(--${light.tone})` : 'inherit' }}>{mxn(Math.max(0, left))}</div>
        <div className={`light ${light.tone}`}>{light.icon} {light.text}</div>
        {reference > 0 && (
          <div style={{ marginTop: 14 }}>
            <Bar value={spent} max={reference} tone={light.tone || 'good'} />
            <div className="note" style={{ marginTop: 4 }}>Este mes llevas gastado {mxn0(spent)}{setAside > 0 ? ` de los ${mxn0(setAside)} que separaste` : ''}</div>
          </div>
        )}
        {reference === 0 && !firstTime && <p className="note" style={{ marginBottom: 0 }}>Cuando registres un ingreso, tú decides cuánto separar para gastar.</p>}
      </div>

      <div className="bigbtns">
        <button className="bigbtn" onClick={ctx.openIncome}><span>💰</span><b>Me llegó dinero</b></button>
        <button className="bigbtn" onClick={ctx.openExpense}><span>🧾</span><b>Gasté algo</b></button>
      </div>

      <h2>Por hacer</h2>
      {todo.length === 0 ? (
        <div className="card ok">🎉 <b>Todo al día.</b> No tienes nada pendiente.</div>
      ) : (
        <div className="list">
          {todo.map((t) => (
            <button key={t.k} className="todo" onClick={t.go}>
              <span className="ico">{t.icon}</span>
              <div className="main"><div className="t">{t.title}</div><div className={`note ${t.tone ? t.tone + '-t' : ''}`}>{t.sub}</div></div>
              <span className="note">›</span>
            </button>
          ))}
          {bills.length > 4 && <Link to="/pagos" className="note" style={{ padding: 10 }}>Ver los {bills.length - 4} pagos restantes →</Link>}
        </div>
      )}

      <h2>Mis ahorros</h2>
      <div className="saves">
        {savings && (
          <Link to="/ahorro" className="card save">
            <div className="note">🌱 Mi ahorro</div>
            <div className="v num">{mxn0(T.env[savings.id]?.balance || 0)}</div>
            <div className="note">Lo que guardas cada vez</div>
          </Link>
        )}
        {investment && (
          <Link to="/inversion" className="card save">
            <div className="note">📈 Mi inversión</div>
            <div className="v num">{mxn0(T.env[investment.id]?.balance || 0)}</div>
            <div className="note">Lo que apartas para invertir</div>
          </Link>
        )}
        <Link to="/metas" className="card save">
          <div className="note">🎯 Mis metas</div>
          {goals.length === 0 ? <div className="v" style={{ fontSize: 15 }}>Crea tu primera meta</div> : (
            <div className="stack" style={{ marginTop: 6 }}>
              {goals.slice(0, 3).map((g) => {
                const b = T.env[g.id]?.balance || 0
                return <div key={g.id}><div className="row" style={{ justifyContent: 'space-between', gap: 6 }}><span>{g.name}</span><span className="note">{g.target_amount ? pct((b / g.target_amount) * 100) + '%' : mxn0(b)}</span></div>{g.target_amount && <Bar value={b} max={Number(g.target_amount)} tone="good" />}</div>
              })}
            </div>
          )}
        </Link>
      </div>

      <div className="row" style={{ marginTop: 22, gap: 8 }}>
        <Link to="/pagos" className="btn">✅ Mis pagos</Link>
        <Link to="/presupuestos" className="btn">🧮 Mis presupuestos</Link>
        <Link to="/prestamos" className="btn">🤝 Préstamos</Link>
        <Link to="/reportes" className="btn">📊 Reportes</Link>
      </div>
    </>
  )
}
