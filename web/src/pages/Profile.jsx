import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import { useSession, SESSION_KEY } from '../JS/useSession'

export default function Profile() {
  const queryClient = useQueryClient()
  const { usuario } = useSession()
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [qr, setQr] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  const setup = useMutation({
    mutationFn: () => api.setup2fa(),
    onSuccess: (data) => {
      setQr(data.qrCodeDataUrl)
      setMensaje({ tipo: 'success', texto: 'Escaneá el código QR y luego confirma el código del autenticador.' })
    },
    onError: (error) => {
      setMensaje({ tipo: 'error', texto: error.message || 'No se pudo preparar la autenticación de dos pasos.' })
    },
  })

  const verify = useMutation({
    mutationFn: (code) => api.verify2fa(code),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_KEY, user)
      setMensaje({ tipo: 'success', texto: 'La autenticación de dos pasos quedó activada.' })
      setCodigo('')
      setQr(null)
    },
    onError: (error) => {
      setMensaje({ tipo: 'error', texto: error.message || 'El código no es válido.' })
    },
  })

  const disable = useMutation({
    mutationFn: (currentPassword) => api.disable2fa(currentPassword),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_KEY, user)
      setMensaje({ tipo: 'success', texto: 'La autenticación de dos pasos quedó desactivada.' })
      setPassword('')
    },
    onError: (error) => {
      setMensaje({ tipo: 'error', texto: error.message || 'No se pudo desactivar la verificación en dos pasos.' })
    },
  })

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h2>Mi cuenta</h2>
          <p className="page-desc">Configurá la verificación en dos pasos para reforzar el acceso.</p>
        </div>
      </div>

      {mensaje && <p className={mensaje.tipo === 'success' ? 'notice success' : 'notice error'}>{mensaje.texto}</p>}

      <div className="editor-section">
        <h3>Autenticación de dos pasos</h3>
        <p className="field-help">Estado actual: {usuario?.totpEnabled ? 'Activada' : 'Desactivada'}</p>

        {!usuario?.totpEnabled && (
          <div className="field-grid">
            <button type="button" className="primary-button" onClick={() => setup.mutate()} disabled={setup.isPending}>
              {setup.isPending ? 'Preparando…' : 'Activar 2FA'}
            </button>
          </div>
        )}

        {qr && (
          <div className="field-grid">
            <img src={qr} alt="Código QR para autenticación de dos pasos" style={{ maxWidth: 220, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff' }} />
            <label>
              <span>Código de verificación</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(event) => setCodigo(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </label>
            <button type="button" className="primary-button" onClick={() => verify.mutate(codigo)} disabled={verify.isPending || codigo.length !== 6}>
              {verify.isPending ? 'Verificando…' : 'Confirmar'}
            </button>
          </div>
        )}

        {usuario?.totpEnabled && (
          <div className="field-grid">
            <label>
              <span>Contraseña para desactivar 2FA</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresá tu contraseña"
              />
            </label>
            <button type="button" className="danger-button" onClick={() => disable.mutate(password)} disabled={disable.isPending || !password}>
              {disable.isPending ? 'Desactivando…' : 'Desactivar 2FA'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
