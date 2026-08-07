import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import { TRIGGERS } from '../JS/automationCatalog'

export default function Automations() {
  const queryClient = useQueryClient()
  const automations = useQuery({ queryKey: ['automations'], queryFn: api.listAutomations })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['automations'] })
  const toggle = useMutation({ mutationFn: api.toggleAutomation, onSuccess: refresh })
  const remove = useMutation({ mutationFn: api.deleteAutomation, onSuccess: refresh })

  function deleteAutomation(automation) {
    if (window.confirm(`¿Eliminar “${automation.name}”? Esta acción no se puede deshacer.`)) {
      remove.mutate(automation.id)
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h2>Automatizaciones</h2>
          <p className="page-desc">Creá reglas que conectan eventos con acciones.</p>
        </div>
        <Link className="primary-link" to="/automations/new">Nueva automatización</Link>
      </div>

      {(toggle.isError || remove.isError) && (
        <p className="alerta" role="alert">No se pudo actualizar la automatización.</p>
      )}
      {automations.isLoading && <p>Cargando automatizaciones…</p>}
      {automations.isError && <p className="alerta" role="alert">No se pudo cargar la lista.</p>}
      {automations.data?.length === 0 && (
        <div className="empty-state">
          <h3>Todavía no hay automatizaciones</h3>
          <p>Creá la primera regla para comenzar a conectar tus servicios.</p>
          <Link className="primary-link" to="/automations/new">Crear automatización</Link>
        </div>
      )}

      <div className="automation-list">
        {automations.data?.map((automation) => (
          <article className="automation-card" key={automation.id}>
            <div className="automation-summary">
              <div>
                <h3>{automation.name}</h3>
                <p>{TRIGGERS[automation.triggerType]?.label || automation.triggerType}</p>
              </div>
              <span className={`automation-status ${automation.enabled ? 'enabled' : ''}`}>
                {automation.enabled ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="automation-meta">
              {automation.actions?.length || 0} {automation.actions?.length === 1 ? 'acción' : 'acciones'}
              {' · '}{automation.conditions?.length || 0} {automation.conditions?.length === 1 ? 'condición' : 'condiciones'}
            </p>
            <div className="card-actions">
              <Link className="secondary-link" to={`/automations/${automation.id}`}>Editar</Link>
              <button type="button" onClick={() => toggle.mutate(automation.id)} disabled={toggle.isPending}>
                {automation.enabled ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteAutomation(automation)} disabled={remove.isPending}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
