import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import './App.css'

// Pantalla inicial: confirma que el frontend se comunica con la API.
// Punto de partida para las páginas de las fases 2 a 9 de TAREAS.md.
export default function App() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    retry: false,
  })

  return (
    <main className="app">
      <h1>FlowHub</h1>
      <p className="lede">Plataforma de automatización personal — Proyecto 02, ISW-811.</p>

      <section className="panel">
        <h2>Estado de la API</h2>
        {isLoading && <p>Conectando…</p>}
        {isError && (
          <p className="error">
            Sin conexión: {error.message}. Verificá que la API esté corriendo en el puerto 4000.
          </p>
        )}
        {data?.status === 'ok' && <p className="ok">API conectada ({data.service})</p>}
      </section>

      <p className="next">
        Próximas pantallas: registro e inicio de sesión, automatizaciones, conexiones OAuth
        e historial de ejecuciones.
      </p>
    </main>
  )
}
