import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NAV } from '../nav'
import { PageHead } from '../ui'

export default function More({ email }) {
  return (
    <>
      <PageHead title="Más" sub="Todo lo demás está aquí." />
      <div className="list">
        {NAV.filter((n) => n !== '-' && !n.tab).map((n) => (
          <Link key={n.to} to={n.to} className="todo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="ico">{n.ico}</span><div className="main t">{n.label}</div><span className="note">›</span>
          </Link>
        ))}
      </div>
      <p className="note" style={{ marginTop: 20 }}>{email} · <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></p>
    </>
  )
}
