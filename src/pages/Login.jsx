import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorMsg } from '../ui'

export default function Login() {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    } else {
      if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Te enviamos un correo para confirmar tu cuenta. Después inicia sesión.')
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <form className="card stack" onSubmit={submit}>
        <div>
          <h1>💸 Mis Finanzas</h1>
          <p className="muted" style={{ margin: 0 }}>{mode === 'in' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}</p>
        </div>
        <div><label>Correo</label><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label>Contraseña</label><input type="password" required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <ErrorMsg msg={error} />
        {info && <div className="banner small">{info}</div>}
        <button className="btn" disabled={busy}>{mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
        <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setInfo('') }}>
          {mode === 'in' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  )
}
