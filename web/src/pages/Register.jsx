import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import { useSession, SESSION_KEY } from '../JS/useSession'

// Traduce los códigos que devuelve la API a mensajes para la persona usuaria.
// El backend responde códigos estables; los textos viven en el frontend.
const MENSAJES = {
  EMAIL_ALREADY_REGISTERED: 'Ese correo ya tiene una cuenta. Iniciá sesión.',
  VALIDATION_ERROR: 'Revisá los datos ingresados.',
}

// Validación en el navegador. Repite las reglas del backend para dar
// respuesta inmediata, pero la validación que manda es siempre la del servidor.
function validar({ email, password, confirmacion }) {
  const errores = {}

  if (!email.trim()) errores.email = 'Ingresá tu correo.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errores.email = 'El correo no tiene un formato válido.'

  if (!password) errores.password = 'Ingresá una contraseña.'
  else if (password.length < 8)
    errores.password = 'La contraseña debe tener al menos 8 caracteres.'

  if (confirmacion !== password) errores.confirmacion = 'Las contraseñas no coinciden.'

  return errores
}

export default function Register() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { autenticado, verificando } = useSession()
  const [campos, setCampos] = useState({ email: '', password: '', confirmacion: '' })
  const [errores, setErrores] = useState({})

  const registro = useMutation({
    mutationFn: ({ email, password }) => api.register(email, password),
    onSuccess: (usuario) => {
      // El registro deja la sesión iniciada: se guarda en caché para que el
      // resto de la aplicación la conozca sin una petición adicional.
      queryClient.setQueryData(SESSION_KEY, usuario)
      navigate('/', { replace: true })
    },
    onError: (error) => {
      // Si el backend detalla los campos, se muestran junto a cada uno.
      if (error.details && Object.keys(error.details).length > 0) {
        setErrores(
          Object.fromEntries(
            Object.entries(error.details).map(([campo, mensajes]) => [campo, mensajes[0]]),
          ),
        )
      }
    },
  })

  // Igual que en el inicio de sesión: si ya hay una cuenta activa, esta
  // página no tiene sentido.
  if (verificando) return <main className="auth"><p>Verificando sesión…</p></main>
  if (autenticado) return <Navigate to="/" replace />

  function actualizar(campo, valor) {
    setCampos((previos) => ({ ...previos, [campo]: valor }))
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }))
  }

  function enviar(evento) {
    evento.preventDefault()
    const encontrados = validar(campos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return
    registro.mutate(campos)
  }

  const errorGeneral =
    registro.isError && !Object.keys(registro.error.details || {}).length
      ? MENSAJES[registro.error.code] || 'No se pudo crear la cuenta. Intentá de nuevo.'
      : null

  return (
    <main className="auth">
      <h1>Crear cuenta en FlowHub</h1>
      <p className="auth-lede">Conectá tus servicios y automatizá tareas repetitivas.</p>

      <form onSubmit={enviar} noValidate>
        {errorGeneral && (
          <p className="alerta" role="alert">
            {errorGeneral}
          </p>
        )}

        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={campos.email}
          onChange={(e) => actualizar('email', e.target.value)}
          aria-invalid={Boolean(errores.email)}
          aria-describedby={errores.email ? 'error-email' : undefined}
        />
        {errores.email && (
          <span className="error-campo" id="error-email">
            {errores.email}
          </span>
        )}

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={campos.password}
          onChange={(e) => actualizar('password', e.target.value)}
          aria-invalid={Boolean(errores.password)}
          aria-describedby={errores.password ? 'error-password' : 'ayuda-password'}
        />
        {errores.password ? (
          <span className="error-campo" id="error-password">
            {errores.password}
          </span>
        ) : (
          <span className="ayuda" id="ayuda-password">
            Mínimo 8 caracteres.
          </span>
        )}

        <label htmlFor="confirmacion">Repetir contraseña</label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          value={campos.confirmacion}
          onChange={(e) => actualizar('confirmacion', e.target.value)}
          aria-invalid={Boolean(errores.confirmacion)}
          aria-describedby={errores.confirmacion ? 'error-confirmacion' : undefined}
        />
        {errores.confirmacion && (
          <span className="error-campo" id="error-confirmacion">
            {errores.confirmacion}
          </span>
        )}

        <button type="submit" disabled={registro.isPending}>
          {registro.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="auth-pie">
        ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </main>
  )
}
