import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { DataProvider } from './lib/DataContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Goals from './pages/Goals'
import Wealth from './pages/Wealth'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', ico: '📊', label: 'Resumen' },
  { to: '/movimientos', ico: '🧾', label: 'Movimientos' },
  { to: '/presupuestos', ico: '🎯', label: 'Presupuestos' },
  { to: '/metas', ico: '🏁', label: 'Metas' },
  { to: '/patrimonio', ico: '🏦', label: 'Patrimonio' },
  { to: '/ajustes', ico: '⚙️', label: 'Ajustes' },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [member, setMember] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setMember(null); return }
    supabase.rpc('is_member').then(({ data }) => setMember(!!data))
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (member === null) return null
  if (!member) {
    return (
      <div className="auth"><div className="card stack">
        <h1>Sin acceso</h1>
        <p className="muted">El correo <b>{session.user.email}</b> no está autorizado para usar esta app.</p>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div></div>
    )
  }

  return (
    <DataProvider>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">💸 Mis Finanzas</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
              <span>{n.ico}</span>{n.label}
            </NavLink>
          ))}
          <div className="spacer" />
          <div className="small muted" style={{ padding: '0 12px' }}>{session.user.email}</div>
          <button className="nav-link" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => supabase.auth.signOut()}>
            <span>🚪</span>Salir
          </button>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimientos" element={<Transactions />} />
            <Route path="/presupuestos" element={<Budgets />} />
            <Route path="/metas" element={<Goals />} />
            <Route path="/patrimonio" element={<Wealth />} />
            <Route path="/ajustes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <nav className="tabbar">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span className="ico">{n.ico}</span>{n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </DataProvider>
  )
}
