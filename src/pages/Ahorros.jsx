import { Link } from 'react-router-dom'
import { useData } from '../lib/DataContext'
import { totals } from '../lib/calc'
import { fmtDate, mxn0, pct } from '../lib/format'
import { Bar, PageHead } from '../ui'

export default function Ahorros() {
  const D = useData()
  const T = totals(D)
  const active = D.envelopes.filter((e) => !e.archived)
  const emergency = active.find((e) => e.kind === 'emergency')
  const longterm = active.find((e) => e.kind === 'longterm')
  const goals = active.filter((e) => e.kind === 'goal').sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'))
  const bal = (e) => T.env[e.id]?.balance || 0

  return (
    <>
      <PageHead title="Mis ahorros" sub="Todo lo que estás guardando, en un solo lugar. Toca una tarjeta para ver el detalle." />
      <div className="stack" style={{ gap: 14 }}>
        {emergency && (
          <Link to="/emergencia" className="card save wide">
            <div className="note">🛟 Colchón para imprevistos</div>
            <div className="v num">{mxn0(bal(emergency))}</div>
            <p className="note" style={{ margin: '2px 0 6px' }}>Dinero para cuando algo sale mal: una llanta, el doctor, un arreglo.</p>
            {emergency.target_amount ? <><Bar value={bal(emergency)} max={Number(emergency.target_amount)} tone="good" /><div className="note">{pct((bal(emergency) / emergency.target_amount) * 100)}% de {mxn0(emergency.target_amount)}</div></> : <div className="note">Apartas {mxn0(emergency.monthly_amount)} al mes</div>}
          </Link>
        )}
        <div className="card wide">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="note">🎯 Mis metas</div>
            <Link to="/metas" className="btn sm">Ver y administrar</Link>
          </div>
          {goals.length === 0 ? <p>Aún no tienes metas. Una meta es algo que quieres lograr, como un viaje, con su monto y su fecha. Yo te digo cuánto apartar cada mes.</p> : (
            <div className="stack" style={{ marginTop: 10 }}>
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{g.name}</b><span className="note">{mxn0(bal(g))}{g.target_amount ? ` de ${mxn0(g.target_amount)}` : ''}</span>
                  </div>
                  {g.target_amount && <Bar value={bal(g)} max={Number(g.target_amount)} tone="good" />}
                  {g.target_date && <div className="note">Para el {fmtDate(g.target_date)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {longterm && (
          <Link to="/largo-plazo" className="card save wide">
            <div className="note">🌱 Ahorro para el futuro</div>
            <div className="v num">{mxn0(bal(longterm))}</div>
            <p className="note" style={{ margin: '2px 0 0' }}>Dinero sin fecha de uso. Recibe una parte de cada ingreso y todo lo que sobra.</p>
          </Link>
        )}
      </div>
    </>
  )
}
