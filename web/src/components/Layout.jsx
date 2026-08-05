import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../JS/api'

// Estructura común de las páginas: cabecera con navegación y contenido.
// El estado de la API se muestra mientras el proyecto está en construcción;
// se puede quitar cuando la aplicación esté completa.
export default function Layout() {
  const { data } = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false })

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
        <span className={data?.status === 'ok' ? 'estado ok' : 'estado'}>
          {data?.status === 'ok' ? 'API conectada' : 'API sin conexión'}
        </span>
      </header>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
