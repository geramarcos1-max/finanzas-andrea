import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NAV } from '../nav'
import { PageHead } from '../ui'

export default function More({ email }) {
  return (
    <>
      <PageHead title="Más" sub="Todas las secciones." />
      <div className="list">
        {NAV.filter((n) => n !== '-').map((n) => (
          <Link key={n.to} to={n.to} className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 20 }}>{n.ico}</span><div className="main t">{n.label}</div><span className="note">›</span>
          </Link>
        ))}
      </div>
      <p className="note" style={{ marginTop: 20 }}>{email} · <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></p>
    </>
  )
}
