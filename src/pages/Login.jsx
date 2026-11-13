import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Dirección a la que vuelve el enlace del correo (sin el #...)
const backUrl = () => `${window.location.origin}${window.location.pathname}`

export default function Login({ notice }) {
  const [mode, setMode] = useState('in')   // in | up | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(notice || '')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    const mail = email.trim()
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: backUrl() })
      if (error) setError(error.message)
      else setInfo(`Si ${mail} tiene cuenta, te enviamos un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`)
    } else if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    } else {
      if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({ email: mail, password })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Te enviamos un correo para confirmar tu cuenta. Después inicia sesión.')
    }
    setBusy(false)
  }

  const go = (m) => { setMode(m); setError(''); setInfo('') }

  return (
    <div className="auth">
      <form className="modal" onSubmit={submit}>
        <div>
          <h3 style={{ fontSize: 22 }}>Finanzas de Andrea</h3>
          <p className="note" style={{ margin: 0 }}>
            {mode === 'in' ? 'Inicia sesión para continuar' : mode === 'up' ? 'Crea tu cuenta' : 'Te enviaremos un enlace para crear una contraseña nueva'}
          </p>
        </div>
        <label className="f">Correo<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'forgot' && (
          <>
            <label className="f">Contraseña
              <input type={show ? 'text' : 'password'} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 18, height: 18, minHeight: 0 }} /> Mostrar contraseña
            </label>
          </>
        )}
        {error && (
          <div className="callout bad" style={{ margin: 0 }} role="alert">
            {error}{mode === 'in' && error.startsWith('Correo o contraseña') && ' Si no la recuerdas, toca “¿Olvidaste tu contraseña?”.'}
          </div>
        )}
        {info && <div className="callout" style={{ margin: 0 }}>{info}</div>}
        <button className="btn pri" disabled={busy}>{mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviarme el enlace'}</button>
        {mode === 'in' && <button type="button" className="link edit" style={{ textAlign: 'center' }} onClick={() => go('forgot')}>¿Olvidaste tu contraseña?</button>}
        {mode === 'forgot'
          ? <button type="button" className="btn" onClick={() => go('in')}>Volver a iniciar sesión</button>
          : <button type="button" className="btn" onClick={() => go(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}</button>}
      </form>
    </div>
  )
}
