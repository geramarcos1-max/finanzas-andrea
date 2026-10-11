import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './lib/DataContext'
import { IncomeFlow } from './flows'
import { Toaster } from './ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Incomes from './pages/Incomes'
import Personal from './pages/Personal'
import Payments from './pages/Payments'
import Fixed from './pages/Fixed'
import Savings from './pages/Savings'
import Goals from './pages/Goals'
import Loans from './pages/Loans'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import More from './pages/More'
import { NAV } from './nav'

const TABS = ['/', '/ingresos', '/personales', '/pagos']

function Shell({ session }) {
  const D = useData()
  const [flow, setFlow] = useState(null)
  const month = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const open = (mode) => setFlow(mode || 'income')

  if (D.loading) return <div className="auth"><p className="note">Cargando…</p></div>
  if (D.error) return <div className="auth"><div className="modal"><h3>No pude cargar los datos</h3><p className="note">{D.error}</p><button className="btn" onClick={D.reload}>Reintentar</button></div></div>

  const ctx = { openIncome: () => open('income'), openAssign: () => open('assign') }
  return (
    <div className="app">
      <aside>
        <div className="brand">Finanzas de Andrea<small>{month}</small></div>
        <nav className="side">
          {NAV.map((n, i) => n === '-' ? <div key={i} className="sep" /> : (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{n.label}</NavLink>
          ))}
        </nav>
        <button className="btn pri cta" onClick={ctx.openIncome}>+ Registrar ingreso</button>
        <div className="who note">{session.user.email}<br />
          <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard ctx={ctx} />} />
          <Route path="/ingresos" element={<Incomes ctx={ctx} />} />
          <Route path="/personales" element={<Personal />} />
          <Route path="/pagos" element={<Payments />} />
          <Route path="/fijos" element={<Fixed />} />
          <Route path="/emergencia" element={<Savings kind="emergency" />} />
          <Route path="/largo-plazo" element={<Savings kind="longterm" />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/prestamos" element={<Loans />} />
          <Route path="/cuentas" element={<Accounts ctx={ctx} />} />
          <Route path="/config" element={<Settings />} />
          <Route path="/mas" element={<More email={session.user.email} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.filter((n) => TABS.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.ico}</span>{n.short || n.label}
          </NavLink>
        ))}
        <NavLink to="/mas" className={({ isActive }) => (isActive ? 'active' : '')}><span className="ico">☰</span>Más</NavLink>
      </nav>
      {flow && <IncomeFlow mode={flow} onClose={() => setFlow(null)} />}
      {/* acceso rápido en celular */}
      <button className="btn pri fab" aria-label="Registrar ingreso" onClick={ctx.openIncome}>+ Ingreso</button>
    </div>
  )
}

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

  let body
  if (session === undefined || (session && member === null)) body = null
  else if (!session) body = <Login />
  else if (!member) {
    body = (
      <div className="auth"><div className="modal">
        <h3>Sin acceso</h3>
        <p className="note">El correo <b>{session.user.email}</b> no está autorizado para usar esta app.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div></div>
    )
  } else body = <DataProvider><Shell session={session} /></DataProvider>

  return <>{body}<Toaster /></>
}
