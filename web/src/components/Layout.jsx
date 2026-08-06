import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import { useSession } from '../JS/useSession'

// Estructura común de las páginas privadas: cabecera con navegación,
// identidad de la persona conectada y salida de sesión.
export default function Layout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { usuario } = useSession()

  const salida = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      // Se vacía toda la caché, no solo la sesión: si otra persona inicia
      // sesión en el mismo navegador no debe ver datos del usuario anterior.
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">FlowHub</span>

        <nav>
          <NavLink to="/" end>Automatizaciones</NavLink>
          <NavLink to="/connections">Conexiones</NavLink>
          <NavLink to="/executions">Historial</NavLink>
          <NavLink to="/profile">Mi cuenta</NavLink>
        </nav>

        <div className="sesion">
          {usuario && <span className="correo">{usuario.email}</span>}
          <button
            type="button"
            className="salir"
            onClick={() => salida.mutate()}
            disabled={salida.isPending}
          >
            {salida.isPending ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      </header>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
