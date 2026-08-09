import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../JS/api'
import { ESTADOS, describirEstado, formatearFecha, calcularDuracion } from '../JS/executionStatus'

const POR_PAGINA = 20

export default function Executions() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const historial = useQuery({
    queryKey: ['executions', status, page],
    queryFn: () => api.listExecutions({ status, page, pageSize: POR_PAGINA }),
    // Mantiene la tabla anterior mientras carga la nueva página: evita que el
    // contenido salte y desaparezca en cada cambio de filtro.
    placeholderData: (anterior) => anterior,
  })

  const resumen = useQuery({ queryKey: ['executions-summary'], queryFn: api.executionsSummary })

  function cambiarFiltro(nuevo) {
    setStatus(nuevo)
    setPage(1)
  }

  const datos = historial.data
  const total = resumen.data
    ? Object.values(resumen.data).reduce((suma, cantidad) => suma + cantidad, 0)
    : null

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h2>Historial de ejecuciones</h2>
          <p className="page-desc">Cada vez que se dispara una automatización queda registrada aquí.</p>
        </div>
        <button type="button" className="secondary-link" onClick={() => historial.refetch()}>
          Actualizar
        </button>
      </div>

      <div className="filtros" role="group" aria-label="Filtrar por estado">
        <button
          type="button"
          className={`chip ${status === '' ? 'activo' : ''}`}
          onClick={() => cambiarFiltro('')}
        >
          Todas {total !== null && <span className="chip-conteo">{total}</span>}
        </button>
        {Object.entries(ESTADOS).map(([clave, { label, tone }]) => (
          <button
            type="button"
            key={clave}
            className={`chip tono-${tone} ${status === clave ? 'activo' : ''}`}
            onClick={() => cambiarFiltro(clave)}
          >
            {label}
            {resumen.data?.[clave] !== undefined && (
              <span className="chip-conteo">{resumen.data[clave]}</span>
            )}
          </button>
        ))}
      </div>

      {historial.isError && (
        <p className="alerta" role="alert">No se pudo cargar el historial.</p>
      )}

      {historial.isLoading && <p>Cargando historial…</p>}

      {datos?.items.length === 0 && (
        <div className="empty-state">
          <h3>{status ? 'Sin ejecuciones con ese estado' : 'Todavía no hay ejecuciones'}</h3>
          <p>
            {status
              ? 'Probá con otro filtro.'
              : 'Cuando una automatización se dispare, su ejecución aparecerá acá.'}
          </p>
        </div>
      )}

      {datos?.items.length > 0 && (
        <>
          <div className="tabla-scroll">
            <table className="tabla-ejecuciones">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Automatización</th>
                  <th>Fecha</th>
                  <th>Duración</th>
                  <th>Intento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((ejecucion) => {
                  const estado = describirEstado(ejecucion.status)
                  return (
                    <tr key={ejecucion.id}>
                      <td><span className={`etiqueta tono-${estado.tone}`}>{estado.label}</span></td>
                      <td>{ejecucion.automation?.name || '—'}</td>
                      <td className="numerico">{formatearFecha(ejecucion.createdAt)}</td>
                      <td className="numerico">
                        {calcularDuracion(ejecucion.startedAt, ejecucion.finishedAt)}
                      </td>
                      <td className="numerico">{(ejecucion.attempt ?? 0) + 1}</td>
                      <td><Link to={`/executions/${ejecucion.id}`}>Ver detalle</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="paginacion">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span>
              Página {datos.page} de {datos.totalPages} · {datos.total} ejecuciones
            </span>
            <button
              type="button"
              disabled={page >= datos.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </section>
  )
}
