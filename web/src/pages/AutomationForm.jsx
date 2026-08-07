import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../JS/api'
import {
  ACTIONS,
  OPERATORS,
  TRIGGERS,
  buildAutomationPayload,
  defaultAction,
  defaultTriggerConfig,
  normalizeAutomation,
  validateAutomationDraft,
} from '../JS/automationCatalog'

const newKey = () => crypto.randomUUID()

function withKeys(automation) {
  return {
    ...automation,
    actions: automation.actions.map((action) => ({ ...action, _key: newKey() })),
    conditions: automation.conditions.map((condition) => ({ ...condition, _key: newKey() })),
  }
}

function emptyDraft() {
  return withKeys({
    name: '',
    enabled: true,
    triggerType: 'GITHUB_WEBHOOK',
    triggerConfig: defaultTriggerConfig('GITHUB_WEBHOOK'),
    conditions: [],
    actions: [defaultAction()],
  })
}

function ConfigField({ field, value, onChange }) {
  const common = {
    id: field.id,
    name: field.name,
    value: value ?? '',
    onChange: (event) => onChange(event.target.value),
  }
  return (
    <label className={field.multiline ? 'full-field' : ''}>
      <span>{field.label}</span>
      {field.type === 'select' ? (
        <select {...common}>
          {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      ) : field.multiline ? (
        <textarea {...common} rows="4" placeholder={field.placeholder} />
      ) : (
        <input {...common} type={field.type || 'text'} min={field.type === 'number' ? '1' : undefined} placeholder={field.placeholder} />
      )}
    </label>
  )
}

export default function AutomationForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState({})

  const automation = useQuery({
    queryKey: ['automation', id],
    queryFn: () => api.getAutomation(id),
    enabled: isEditing,
  })

  useEffect(() => {
    if (automation.data) setDraft(withKeys(normalizeAutomation(automation.data)))
  }, [automation.data])

  const save = useMutation({
    mutationFn: (payload) => isEditing ? api.updateAutomation(id, payload) : api.createAutomation(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['automations'] })
      navigate('/', { replace: true })
    },
  })

  function updateTriggerType(triggerType) {
    setDraft((current) => ({
      ...current,
      triggerType,
      triggerConfig: defaultTriggerConfig(triggerType),
    }))
  }

  function updateAction(index, updater) {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((action, actionIndex) => actionIndex === index ? updater(action) : action),
    }))
  }

  function changeActionProvider(index, provider) {
    const replacement = { ...defaultAction(provider), _key: draft.actions[index]._key }
    updateAction(index, () => replacement)
  }

  function changeActionType(index, actionType) {
    updateAction(index, (action) => ({
      ...action,
      actionType,
      params: Object.fromEntries(ACTIONS[action.provider].types[actionType].fields.map((field) => [field.name, ''])),
    }))
  }

  function moveAction(index, direction) {
    const target = index + direction
    if (target < 0 || target >= draft.actions.length) return
    setDraft((current) => {
      const actions = [...current.actions]
      ;[actions[index], actions[target]] = [actions[target], actions[index]]
      return { ...current, actions }
    })
  }

  function updateCondition(index, field, value) {
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, [field]: value } : condition),
    }))
  }

  function submit(event) {
    event.preventDefault()
    const validationErrors = validateAutomationDraft(draft)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    save.mutate(buildAutomationPayload(draft))
  }

  if (automation.isLoading) return <section className="page"><p>Cargando automatización…</p></section>
  if (automation.isError) return <section className="page"><p className="alerta">No se encontró la automatización.</p><Link to="/">Volver</Link></section>

  const trigger = TRIGGERS[draft.triggerType]

  return (
    <section className="page automation-editor">
      <div className="page-heading">
        <div>
          <h2>{isEditing ? 'Editar automatización' : 'Nueva automatización'}</h2>
          <p className="page-desc">Definí el evento, las condiciones y las acciones en orden.</p>
        </div>
        <Link className="secondary-link" to="/">Cancelar</Link>
      </div>

      {save.isError && (
        <p className="alerta" role="alert">
          {save.error.code === 'VALIDATION_ERROR'
            ? 'Revisá los campos indicados e intentá nuevamente.'
            : 'No se pudo guardar la automatización.'}
        </p>
      )}

      <form onSubmit={submit} noValidate>
        <fieldset className="editor-section">
          <legend>Información general</legend>
          <label>
            <span>Nombre</span>
            <input
              value={draft.name}
              maxLength="120"
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              aria-invalid={Boolean(errors.name || save.error?.details?.name)}
              placeholder="Avisar cuando llegue un correo importante"
            />
          </label>
          {(errors.name || save.error?.details?.name?.[0]) && <span className="error-campo">{errors.name || save.error.details.name[0]}</span>}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Activar al guardar
          </label>
        </fieldset>

        <fieldset className="editor-section">
          <legend>Cuando ocurra…</legend>
          <label>
            <span>Disparador</span>
            <select value={draft.triggerType} onChange={(event) => updateTriggerType(event.target.value)}>
              {Object.entries(TRIGGERS).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}
            </select>
          </label>
          <p className="field-help">{trigger.description}</p>
          <div className="field-grid">
            {trigger.fields.map((field) => (
              <ConfigField
                field={{ ...field, id: `trigger-${field.name}` }}
                value={draft.triggerConfig[field.name]}
                onChange={(value) => setDraft((current) => ({
                  ...current,
                  triggerConfig: { ...current.triggerConfig, [field.name]: value },
                }))}
                key={field.name}
              />
            ))}
          </div>
          {errors.triggerConfig && <span className="error-campo">{errors.triggerConfig}</span>}
        </fieldset>

        <fieldset className="editor-section">
          <div className="section-heading">
            <legend>Solo si…</legend>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDraft((current) => ({
                ...current,
                conditions: [...current.conditions, { _key: newKey(), field: '', operator: 'eq', value: '' }],
              }))}
            >
              Agregar condición
            </button>
          </div>
          {draft.conditions.length === 0 && <p className="field-help">Sin condiciones: cualquier evento ejecutará las acciones.</p>}
          {draft.conditions.map((condition, index) => (
            <div className="condition-row" key={condition._key}>
              <input value={condition.field} onChange={(event) => updateCondition(index, 'field', event.target.value)} placeholder="trigger.campo" aria-label={`Campo de condición ${index + 1}`} />
              <select value={condition.operator} onChange={(event) => updateCondition(index, 'operator', event.target.value)} aria-label={`Operador de condición ${index + 1}`}>
                {Object.entries(OPERATORS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <input value={condition.value} onChange={(event) => updateCondition(index, 'value', event.target.value)} placeholder="Valor esperado" aria-label={`Valor de condición ${index + 1}`} />
              <button type="button" className="icon-button danger-button" onClick={() => setDraft((current) => ({ ...current, conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Eliminar condición ${index + 1}`}>×</button>
            </div>
          ))}
          {errors.conditions && <span className="error-campo">{errors.conditions}</span>}
        </fieldset>

        <fieldset className="editor-section">
          <div className="section-heading">
            <legend>Hacer lo siguiente…</legend>
            <button type="button" className="secondary-button" onClick={() => setDraft((current) => ({ ...current, actions: [...current.actions, { ...defaultAction(), _key: newKey() }] }))}>
              Agregar acción
            </button>
          </div>
          <p className="field-help">Podés usar plantillas como <code>{'{{trigger.email}}'}</code> en cualquier parámetro.</p>
          <div className="action-list">
            {draft.actions.map((action, index) => {
              const actionDefinition = ACTIONS[action.provider].types[action.actionType]
              return (
                <article className="action-editor" key={action._key}>
                  <div className="action-heading">
                    <strong>Acción {index + 1}</strong>
                    <div className="row-buttons">
                      <button type="button" className="icon-button" onClick={() => moveAction(index, -1)} disabled={index === 0} aria-label={`Subir acción ${index + 1}`}>↑</button>
                      <button type="button" className="icon-button" onClick={() => moveAction(index, 1)} disabled={index === draft.actions.length - 1} aria-label={`Bajar acción ${index + 1}`}>↓</button>
                      <button type="button" className="icon-button danger-button" onClick={() => setDraft((current) => ({ ...current, actions: current.actions.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Eliminar acción ${index + 1}`}>×</button>
                    </div>
                  </div>
                  <div className="field-grid">
                    <label>
                      <span>Proveedor</span>
                      <select value={action.provider} onChange={(event) => changeActionProvider(index, event.target.value)}>
                        {Object.entries(ACTIONS).map(([value, provider]) => <option value={value} key={value}>{provider.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Tipo de acción</span>
                      <select value={action.actionType} onChange={(event) => changeActionType(index, event.target.value)}>
                        {Object.entries(ACTIONS[action.provider].types).map(([value, type]) => <option value={value} key={value}>{type.label}</option>)}
                      </select>
                    </label>
                    {actionDefinition.fields.map((field) => (
                      <ConfigField
                        field={{ ...field, id: `action-${action._key}-${field.name}` }}
                        value={action.params[field.name]}
                        onChange={(value) => updateAction(index, (current) => ({ ...current, params: { ...current.params, [field.name]: value } }))}
                        key={field.name}
                      />
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
          {(errors.actions || save.error?.details?.actions?.[0]) && <span className="error-campo">{errors.actions || save.error.details.actions[0]}</span>}
        </fieldset>

        <div className="form-actions">
          <Link className="secondary-link" to="/">Cancelar</Link>
          <button className="primary-button" type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear automatización'}
          </button>
        </div>
      </form>
    </section>
  )
}
