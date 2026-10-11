import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './lib/DataContext'
import { AddMenu, BankStepsModal, IncomeFlow, PaymentFormModal, QuickExpense } from './flows'
import { NAV } from './nav'
import { Toaster } from './ui'
import Login from './pages/Login'
import Home from './pages/Dashboard'
import Reports from './pages/Reports'
import Incomes from './pages/Incomes'
import Personal from './pages/Personal'
import Payments from './pages/Payments'
import Savings from './pages/Savings'
import Ahorros from './pages/Ahorros'
import Budgets from './pages/Budgets'
import Setup from './Setup'
import Goals from './pages/Goals'
import Loans from './pages/Loans'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import Guide from './pages/Guide'
import More from './pages/More'

function Shell({ session }) {
  const D = useData()
  const [flow, setFlow] = useState(null)
  const month = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  if (D.loading) return <div className="auth"><p className="note">Cargando…</p></div>
  if (D.error) return <div className="auth"><div className="modal"><h3>No pude cargar los datos</h3><p className="note">{D.error}</p><button className="btn" onClick={D.reload}>Reintentar</button></div></div>

  // Primera vez: configurar cuánto dinero tiene (ocurre una sola vez)
  if (!D.settings.setup_done) return <Setup email={session.user.email} onDone={(goAssign) => goAssign && setFlow('assign')} />

  const ctx = {
    openIncome: () => setFlow('income'), openAssign: () => setFlow('assign'), openExpense: () => setFlow('expense'),
    openBank: () => setFlow('bank'), openMenu: () => setFlow('menu'), openPayment: () => setFlow('payment'),
  }
  const close = () => setFlow(null)
  return (
    <div className="app">
      <aside>
        <div className="brand">Finanzas de Andrea<small>{month}</small></div>
        <nav className="side">
          {NAV.map((n, i) => n === '-' ? <div key={i} className="sep" /> : (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{n.ico} {n.label}</NavLink>
          ))}
        </nav>
        <button className="btn pri cta" onClick={ctx.openIncome}>💰 Me llegó dinero</button>
        <button className="btn cta" onClick={ctx.openExpense}>🧾 Gasté algo</button>
        <div className="who note">{session.user.email}<br />
          <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Home ctx={ctx} />} />
          <Route path="/pagos" element={<Payments />} />
          <Route path="/ahorros" element={<Ahorros />} />
          <Route path="/cuentas" element={<Accounts ctx={ctx} />} />
          <Route path="/personales" element={<Personal />} />
          <Route path="/ingresos" element={<Incomes ctx={ctx} />} />
          <Route path="/ahorro" element={<Savings kind="savings" />} />
          <Route path="/inversion" element={<Savings kind="investment" />} />
          <Route path="/fijos" element={<Navigate to="/pagos" replace />} />
          <Route path="/emergencia" element={<Navigate to="/ahorros" replace />} />
          <Route path="/largo-plazo" element={<Navigate to="/ahorro" replace />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/presupuestos" element={<Budgets />} />
          <Route path="/prestamos" element={<Loans />} />
          <Route path="/reportes" element={<Reports ctx={ctx} />} />
          <Route path="/guia" element={<Guide />} />
          <Route path="/config" element={<Settings />} />
          <Route path="/mas" element={<More email={session.user.email} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.ico}</span>{n.label}
          </NavLink>
        ))}
        <NavLink to="/mas" className={({ isActive }) => (isActive ? 'active' : '')}><span className="ico">☰</span>Más</NavLink>
      </nav>
      <button className="fab" aria-label="Agregar" onClick={ctx.openMenu}>＋</button>
      {flow === 'income' && <IncomeFlow mode="income" onClose={close} />}
      {flow === 'assign' && <IncomeFlow mode="assign" onClose={close} />}
      {flow === 'expense' && <QuickExpense onClose={close} />}
      {flow === 'bank' && <BankStepsModal onClose={close} />}
      {flow === 'menu' && <AddMenu ctx={ctx} onClose={close} />}
      {flow === 'payment' && <PaymentFormModal onClose={close} />}
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
