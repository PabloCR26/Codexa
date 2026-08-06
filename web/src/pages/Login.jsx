import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import { useSession, SESSION_KEY } from '../JS/useSession'

// El backend responde el mismo código para contraseña incorrecta y para
// usuario inexistente, así que aquí solo hay un mensaje: no debe revelarse
// qué correos están registrados.
const MENSAJES = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  VALIDATION_ERROR: 'Revisá los datos ingresados.',
}

function validar({ email, password }) {
  const errores = {}
  if (!email.trim()) errores.email = 'Ingresá tu correo.'
  if (!password) errores.password = 'Ingresá tu contraseña.'
  return errores
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { autenticado, verificando } = useSession()
  const [campos, setCampos] = useState({ email: '', password: '' })
  const [errores, setErrores] = useState({})

  // RequireAuth guarda aquí la ruta que se intentó abrir sin sesión, para
  // volver a ella una vez iniciada.
  const destino = location.state?.from || '/'

  const acceso = useMutation({
    mutationFn: ({ email, password }) => api.login(email, password),
    onSuccess: (usuario) => {
      // Se guarda la sesión en caché para que el resto de la aplicación la
      // conozca de inmediato, sin una petición adicional.
      queryClient.setQueryData(SESSION_KEY, usuario)
      navigate(destino, { replace: true })
    },
  })

  // Mientras se comprueba la sesión no se muestra el formulario, para evitar
  // que aparezca un instante y desaparezca al redirigir.
  if (verificando) return <main className="auth"><p>Verificando sesión…</p></main>

  // Si ya hay sesión, esta página no tiene sentido. Debe usarse `destino` y no
  // una ruta fija: al iniciar sesión esta condición se cumple de inmediato y,
  // con "/" fijo, se perdería la página que la persona quería abrir.
  if (autenticado) return <Navigate to={destino} replace />

  function actualizar(campo, valor) {
    setCampos((previos) => ({ ...previos, [campo]: valor }))
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }))
  }

  function enviar(evento) {
    evento.preventDefault()
    const encontrados = validar(campos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return
    acceso.mutate(campos)
  }

  const errorGeneral = acceso.isError
    ? MENSAJES[acceso.error.code] || 'No se pudo iniciar sesión. Intentá de nuevo.'
    : null

  return (
    <main className="auth">
      <h1>Iniciar sesión</h1>
      <p className="auth-lede">Ingresá para administrar tus automatizaciones.</p>

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
          autoComplete="current-password"
          value={campos.password}
          onChange={(e) => actualizar('password', e.target.value)}
          aria-invalid={Boolean(errores.password)}
          aria-describedby={errores.password ? 'error-password' : undefined}
        />
        {errores.password && (
          <span className="error-campo" id="error-password">
            {errores.password}
          </span>
        )}

        <button type="submit" disabled={acceso.isPending}>
          {acceso.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="auth-pie">
        ¿No tenés cuenta? <Link to="/register">Crear una</Link>
      </p>
    </main>
  )
}
