// Estados de una ejecución, con su texto y su color.
// Deben coincidir con el enum ExecutionStatus de prisma/schema.prisma.
export const ESTADOS = {
  PENDING: { label: 'Pendiente', tone: 'pending' },
  RUNNING: { label: 'En curso', tone: 'running' },
  SUCCEEDED: { label: 'Exitosa', tone: 'success' },
  FAILED: { label: 'Fallida', tone: 'error' },
  SKIPPED: { label: 'Omitida', tone: 'neutral' },
}

export function describirEstado(status) {
  return ESTADOS[status] || { label: status, tone: 'neutral' }
}

// Fecha corta y legible; las horas importan más que el año en una bitácora.
export function formatearFecha(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Duración entre inicio y fin, para ver de un vistazo cuánto tardó.
export function calcularDuracion(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '—'
  const ms = new Date(finishedAt) - new Date(startedAt)
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}
