import { useQuery } from '@tanstack/react-query'
import { api } from './api'

// Estado de la sesión actual, consultado a GET /api/auth/me.
//
// Cuando no hay sesión la API responde 401 y la consulta queda en error:
// eso no es una falla, es la respuesta esperada para una visita anónima.
// Por eso retry queda en false, para no repetir la petición sin sentido.
export const SESSION_KEY = ['session']

export function useSession() {
  const { data, isLoading, isError } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: api.me,
    retry: false,
    // Evita volver a preguntar en cada cambio de pestaña o de ruta.
    staleTime: 5 * 60 * 1000,
  })

  return {
    usuario: data ?? null,
    autenticado: Boolean(data) && !isError,
    verificando: isLoading,
  }
}
