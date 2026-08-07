import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAutomationPayload,
  defaultAction,
  defaultTriggerConfig,
  validateAutomationDraft,
} from '../web/src/JS/automationCatalog.js'

test('crea configuraciones iniciales compatibles con el contrato del backend', () => {
  assert.deepEqual(defaultTriggerConfig('CRON'), {
    expression: '',
    timezone: '',
  })
  assert.deepEqual(defaultAction('GITHUB'), {
    provider: 'GITHUB',
    actionType: 'create_issue',
    params: { owner: '', repo: '', title: '', body: '' },
  })
})

test('construye el payload sin las claves internas de React', () => {
  const payload = buildAutomationPayload({
    name: '  Automatización de prueba  ',
    enabled: true,
    triggerType: 'CRON',
    triggerConfig: { expression: '0 9 * * *', timezone: 'America/Costa_Rica' },
    conditions: [{ _key: 'condition-key', field: ' trigger.total ', operator: 'gt', value: '10' }],
    actions: [{
      _key: 'action-key',
      provider: 'TELEGRAM',
      actionType: 'send_message',
      params: { chatId: '123', text: '{{trigger.title}}' },
    }],
  })

  assert.equal(payload.name, 'Automatización de prueba')
  assert.deepEqual(payload.conditions[0], { field: 'trigger.total', operator: 'gt', value: '10' })
  assert.equal(Object.hasOwn(payload.actions[0], '_key'), false)
  assert.equal(payload.actions[0].params.text, '{{trigger.title}}')
})

test('detecta formularios incompletos antes de enviarlos', () => {
  const errors = validateAutomationDraft({
    name: ' ',
    triggerConfig: { expression: '' },
    conditions: [{ field: '', operator: 'eq', value: 'x' }],
    actions: [],
  })

  assert.deepEqual(Object.keys(errors).sort(), ['actions', 'conditions', 'name', 'triggerConfig'])
})
