import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../JS/api'
import { describirEstado, formatearFecha, calcularDuracion } from '../JS/executionStatus'

// Muestra un objeto tal cual llegó. La bitácora sirve para diagnosticar, así
// que conviene ver los datos crudos y no una versión resumida.
function BloqueJson({ titulo, contenido, descripcion }) {
  const vacio = contenido === null || contenido === undefined
  return (
    <section className="bloque-detalle">
      <h3>{titulo}</h3>
      {descripcion && <p className="page-desc">{descripcion}</p>}
      {vacio ? (
        <p className="sin-datos">Sin datos.</p>
      ) : (
        <pre className="json">{JSON.stringify(contenido, null, 2)}</pre>
      )}
    </section>
  )
}

export default function ExecutionDetail() {
  const { id } = useParams()
  const ejecucion = useQuery({
    queryKey: ['execution', id],
    queryFn: () => api.getExecution(id),
    retry: false,
  })

  if (ejecucion.isLoading) {
    return <section className="page"><p>Cargando ejecución…</p></section>
  }

  if (ejecucion.isError) {
    return (
      <section className="page">
        <p className="alerta" role="alert">
          {ejecucion.error.code === 'EXECUTION_NOT_FOUND'
            ? 'Esa ejecución no existe o no te pertenece.'
            : 'No se pudo cargar la ejecución.'}
        </p>
        <Link to="/executions">Volver al historial</Link>
      </section>
    )
  }

  const e = ejecucion.data
  const estado = describirEstado(e.status)

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h2>Detalle de ejecución</h2>
          <p className="page-desc">{e.automation?.name}</p>
        </div>
        <Link className="secondary-link" to="/executions">Volver al historial</Link>
      </div>

      <dl className="ficha">
        <div>
          <dt>Estado</dt>
          <dd><span className={`etiqueta tono-${estado.tone}`}>{estado.label}</span></dd>
        </div>
        <div>
          <dt>Disparador</dt>
          <dd>{e.automation?.triggerType || '—'}</dd>
        </div>
        <div>
          <dt>Evento</dt>
          <dd className="monoespaciado">{e.eventId}</dd>
        </div>
        <div>
          <dt>Intento</dt>
          <dd>{(e.attempt ?? 0) + 1}</dd>
        </div>
        <div>
          <dt>Creada</dt>
          <dd>{formatearFecha(e.createdAt)}</dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{calcularDuracion(e.startedAt, e.finishedAt)}</dd>
        </div>
      </dl>

      {e.error && (
        <section className="bloque-detalle error">
          <h3>Error</h3>
          <p className="mensaje-error">{e.error.message}</p>
          <p className="page-desc">
            Código <span className="monoespaciado">{e.error.code}</span>
            {e.error.statusCode ? ` · HTTP ${e.error.statusCode}` : ''}
          </p>
        </section>
      )}

      <BloqueJson
        titulo="Entrada del disparador"
        descripcion="Datos del evento que originó la ejecución. Son los que alimentan las plantillas."
        contenido={e.triggerData}
      />

      <BloqueJson
        titulo="Salida"
        descripcion="Resultado devuelto por cada acción, en el orden en que se ejecutaron."
        contenido={e.output}
      />
    </section>
  )
}
