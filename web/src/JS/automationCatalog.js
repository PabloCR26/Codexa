export const TRIGGERS = {
  GITHUB_WEBHOOK: {
    label: 'Webhook de GitHub',
    description: 'Se activa cuando GitHub envía un evento del repositorio.',
    fields: [
      { name: 'owner', label: 'Propietario', placeholder: 'organizacion-o-usuario' },
      { name: 'repo', label: 'Repositorio', placeholder: 'mi-repositorio' },
      {
        name: 'event',
        label: 'Evento',
        type: 'select',
        options: [
          { value: 'issues', label: 'Issues' },
          { value: 'push', label: 'Push' },
          { value: 'pull_request', label: 'Pull request' },
        ],
      },
    ],
  },
  GMAIL_POLL: {
    label: 'Consulta periódica de Gmail',
    description: 'Busca mensajes que coincidan con una consulta de Gmail.',
    fields: [
      { name: 'query', label: 'Consulta', placeholder: 'is:unread from:persona@example.com' },
      { name: 'intervalMinutes', label: 'Intervalo (minutos)', type: 'number', placeholder: '5' },
    ],
  },
  CRON: {
    label: 'Horario programado',
    description: 'Se activa siguiendo una expresión cron.',
    fields: [
      { name: 'expression', label: 'Expresión cron', placeholder: '0 9 * * 1-5' },
      { name: 'timezone', label: 'Zona horaria', placeholder: 'America/Costa_Rica' },
    ],
  },
}

export const ACTIONS = {
  GOOGLE: {
    label: 'Gmail',
    types: {
      send_email: {
        label: 'Enviar correo',
        fields: [
          { name: 'to', label: 'Destinatario', placeholder: '{{trigger.email}}' },
          { name: 'subject', label: 'Asunto', placeholder: 'Nuevo evento: {{trigger.title}}' },
          { name: 'body', label: 'Mensaje', placeholder: 'Contenido de {{trigger.body}}', multiline: true },
        ],
      },
    },
  },
  GITHUB: {
    label: 'GitHub',
    types: {
      create_issue: {
        label: 'Crear issue',
        fields: [
          { name: 'owner', label: 'Propietario', placeholder: 'organizacion-o-usuario' },
          { name: 'repo', label: 'Repositorio', placeholder: 'mi-repositorio' },
          { name: 'title', label: 'Título', placeholder: '{{trigger.subject}}' },
          { name: 'body', label: 'Descripción', placeholder: '{{trigger.body}}', multiline: true },
        ],
      },
    },
  },
  TELEGRAM: {
    label: 'Telegram',
    types: {
      send_message: {
        label: 'Enviar mensaje',
        fields: [
          { name: 'chatId', label: 'Chat ID', placeholder: '123456789' },
          { name: 'text', label: 'Mensaje', placeholder: 'Evento: {{trigger.title}}', multiline: true },
        ],
      },
    },
  },
}

export const OPERATORS = {
  eq: 'Igual a',
  neq: 'Distinto de',
  contains: 'Contiene',
  gt: 'Mayor que',
  lt: 'Menor que',
}

export function defaultTriggerConfig(triggerType) {
  return Object.fromEntries(TRIGGERS[triggerType].fields.map((field) => [
    field.name,
    field.type === 'select' ? field.options[0].value : '',
  ]))
}

export function defaultAction(provider = 'GOOGLE') {
  const actionType = Object.keys(ACTIONS[provider].types)[0]
  const fields = ACTIONS[provider].types[actionType].fields
  return {
    provider,
    actionType,
    params: Object.fromEntries(fields.map((field) => [field.name, ''])),
  }
}

export function normalizeAutomation(automation) {
  return {
    name: automation.name,
    enabled: automation.enabled,
    triggerType: automation.triggerType,
    triggerConfig: automation.triggerConfig || defaultTriggerConfig(automation.triggerType),
    conditions: Array.isArray(automation.conditions) ? automation.conditions : [],
    actions: Array.isArray(automation.actions) && automation.actions.length
      ? automation.actions
      : [defaultAction()],
  }
}

export function buildAutomationPayload(draft) {
  return {
    name: draft.name.trim(),
    enabled: Boolean(draft.enabled),
    triggerType: draft.triggerType,
    triggerConfig: { ...draft.triggerConfig },
    conditions: draft.conditions.map(({ field, operator, value }) => ({
      field: field.trim(),
      operator,
      value,
    })),
    actions: draft.actions.map(({ provider, actionType, params }) => ({
      provider,
      actionType,
      params: { ...params },
    })),
  }
}

export function validateAutomationDraft(draft) {
  const errors = {}
  if (!draft.name.trim()) errors.name = 'El nombre es obligatorio.'
  if (draft.actions.length === 0) errors.actions = 'Agregá al menos una acción.'
  if (Object.values(draft.triggerConfig).some((value) => String(value).trim() === '')) {
    errors.triggerConfig = 'Completá la configuración del disparador.'
  }
  if (draft.actions.some((action) => Object.values(action.params).some((value) => String(value).trim() === ''))) {
    errors.actions = 'Completá todos los parámetros de las acciones.'
  }
  if (draft.conditions.some((condition) => !condition.field.trim())) {
    errors.conditions = 'Toda condición necesita un campo.'
  }
  return errors
}
