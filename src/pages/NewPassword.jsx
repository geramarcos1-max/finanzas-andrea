import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Se muestra cuando alguien llega desde el enlace del correo de "olvidé mi contraseña".
export default function NewPassword({ email, onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (pw !== pw2) return setError('Las dos contraseñas no son iguales.')
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(error.message)
    window.history.replaceState(null, '', window.location.pathname)   // quita el enlace de recuperación de la barra
    onDone()
  }

  return (
    <div className="auth">
      <form className="modal" onSubmit={submit}>
        <div>
          <h3 style={{ fontSize: 22 }}>Crea tu contraseña nueva</h3>
          <p className="note" style={{ margin: 0 }}>Para la cuenta {email}</p>
        </div>
        <label className="f">Contraseña nueva
          <input type={show ? 'text' : 'password'} required autoFocus autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="f">Repítela
          <input type={show ? 'text' : 'password'} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 18, height: 18, minHeight: 0 }} /> Mostrar contraseña
        </label>
        {error && <div className="callout bad" style={{ margin: 0 }} role="alert">{error}</div>}
        <button className="btn pri" disabled={busy}>Guardar contraseña</button>
      </form>
    </div>
  )
}
