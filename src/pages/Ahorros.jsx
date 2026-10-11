import { Link } from 'react-router-dom'
import { useData } from '../lib/DataContext'
import { totals } from '../lib/calc'
import { fmtDate, mxn0, pct } from '../lib/format'
import { Bar, PageHead } from '../ui'

export default function Ahorros() {
  const D = useData()
  const T = totals(D)
  const active = D.envelopes.filter((e) => !e.archived)
  const savings = active.find((e) => e.kind === 'savings')
  const investment = active.find((e) => e.kind === 'investment')
  const goals = active.filter((e) => e.kind === 'goal').sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'))
  const bal = (e) => T.env[e.id]?.balance || 0

  return (
    <>
      <PageHead title="Mis ahorros" sub="Todo lo que estás guardando, en un solo lugar. Toca una tarjeta para ver el detalle." />
      <div className="stack" style={{ gap: 14 }}>
        <div className="card wide">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="note">🎯 Mis metas</div>
            <Link to="/metas" className="btn sm">Ver y administrar</Link>
          </div>
          {goals.length === 0 ? <p>Aún no tienes metas. Una meta es algo que quieres lograr, como un viaje o un colchón para imprevistos, con su monto y su fecha. Yo te digo cuánto abonar cada mes.</p> : (
            <div className="stack" style={{ marginTop: 10 }}>
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{g.name}</b><span className="note">{mxn0(bal(g))}{g.target_amount ? ` de ${mxn0(g.target_amount)} · ${pct((bal(g) / g.target_amount) * 100)}%` : ''}</span>
                  </div>
                  {g.target_amount && <Bar value={bal(g)} max={Number(g.target_amount)} tone="good" />}
                  {g.target_date && <div className="note">Para el {fmtDate(g.target_date)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {savings && (
          <Link to="/ahorro" className="card save wide">
            <div className="note">🌱 Mi ahorro</div>
            <div className="v num">{mxn0(bal(savings))}</div>
            <p className="note" style={{ margin: '2px 0 0' }}>Dinero que guardas sin un fin específico.</p>
          </Link>
        )}
        {investment && (
          <Link to="/inversion" className="card save wide">
            <div className="note">📈 Mi inversión</div>
            <div className="v num">{mxn0(bal(investment))}</div>
            <p className="note" style={{ margin: '2px 0 0' }}>Dinero que apartas para invertir.</p>
          </Link>
        )}
      </div>
    </>
  )
}
