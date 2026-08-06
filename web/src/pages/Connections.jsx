import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api, startOAuth } from '../JS/api'

const providers = [
  {
    key: 'google',
    apiName: 'GOOGLE',
    name: 'Google',
    description: 'Permite leer, organizar y enviar mensajes con Gmail.',
  },
  {
    key: 'github',
    apiName: 'GITHUB',
    name: 'GitHub',
    description: 'Permite reaccionar a eventos y crear issues en repositorios.',
  },
]

export default function Connections() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const connections = useQuery({ queryKey: ['connections'], queryFn: api.listConnections })
  const revoke = useMutation({
    mutationFn: api.deleteConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  })

  useEffect(() => {
    if (searchParams.has('connected') || searchParams.has('error')) {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    }
  }, [queryClient, searchParams])

  function dismissNotice() {
    setSearchParams({}, { replace: true })
  }

  const connectedProvider = searchParams.get('connected')
  const failedProvider = searchParams.get('error')

  return (
    <section className="page">
      <h2>Conexiones</h2>
      <p className="page-desc">Conectá los servicios que usarán tus automatizaciones.</p>

      {connectedProvider && (
        <div className="notice success" role="status">
          {connectedProvider === 'google' ? 'Google' : 'GitHub'} se conectó correctamente.
          <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {failedProvider && (
        <div className="notice error" role="alert">
          No se pudo conectar {failedProvider === 'google' ? 'Google' : 'GitHub'}. Intentá de nuevo.
          <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {connections.isError && <p className="alerta" role="alert">No se pudieron cargar las conexiones.</p>}
      {revoke.isError && <p className="alerta" role="alert">No se pudo revocar la conexión.</p>}

      <div className="connection-grid" aria-busy={connections.isLoading}>
        {providers.map((provider) => {
          const connection = connections.data?.find((item) => item.provider === provider.apiName)
          const account = connection?.metadata?.email || connection?.metadata?.login
          return (
            <article className="connection-card" key={provider.key}>
              <div className="connection-heading">
                <h3>{provider.name}</h3>
                <span className={`connection-status ${connection ? 'connected' : ''}`}>
                  {connection ? 'Conectado' : 'Sin conectar'}
                </span>
              </div>
              <p>{provider.description}</p>
              {account && <p className="connection-account">Cuenta: {account}</p>}
              {connection ? (
                <button
                  type="button"
                  className="danger-button"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(connection.id)}
                >
                  {revoke.isPending && revoke.variables === connection.id ? 'Revocando…' : 'Revocar conexión'}
                </button>
              ) : (
                <button type="button" disabled={connections.isLoading} onClick={() => startOAuth(provider.key)}>
                  Conectar {provider.name}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
