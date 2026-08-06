import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../JS/useSession'

// Puerta de entrada a las rutas privadas: sin sesión activa redirige al login.
//
// Esto es una comodidad de la interfaz, no la medida de seguridad: el aislamiento
// real lo impone la API, que exige la cookie de sesión en cada petición y filtra
// por userId. Alguien podría saltarse este componente y aun así no vería datos
// ajenos.
export default function RequireAuth() {
  const { autenticado, verificando } = useSession()
  const location = useLocation()

  // Sin esta espera se vería un parpadeo hacia el login antes de confirmar
  // que la sesión existe.
  if (verificando) {
    return (
      <main className="auth">
        <p>Verificando sesión…</p>
      </main>
    )
  }

  if (!autenticado) {
    // Se recuerda a dónde quería entrar para volver ahí después del login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
