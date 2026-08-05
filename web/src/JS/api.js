// Cliente HTTP hacia la API.
//
// credentials: 'include' es obligatorio en todas las peticiones: sin eso la
// cookie de sesión no viaja y el backend responde 401.
//
// En desarrollo VITE_API_URL queda vacío y el proxy de Vite reenvía /api al
// backend. En Docker se define en tiempo de build (build args), porque Vite
// incrusta las variables VITE_* al compilar y no las lee en tiempo de ejecución.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

async function request(path, options = {}) {
  const response = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || detail.error || `Error ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

export const api = {
  health: () => request('/health'),

  // Sesión
  me: () => request('/auth/me'),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, name) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Automatizaciones
  listAutomations: () => request('/automations'),
  getAutomation: (id) => request(`/automations/${id}`),
  createAutomation: (data) =>
    request('/automations', { method: 'POST', body: JSON.stringify(data) }),
  updateAutomation: (id, data) =>
    request(`/automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleAutomation: (id) => request(`/automations/${id}/toggle`, { method: 'PATCH' }),
  deleteAutomation: (id) => request(`/automations/${id}`, { method: 'DELETE' }),

  // Conexiones OAuth
  listConnections: () => request('/connections'),
  deleteConnection: (id) => request(`/connections/${id}`, { method: 'DELETE' }),

  // Bitácora
  listExecutions: (query = '') => request(`/executions${query}`),
  getExecution: (id) => request(`/executions/${id}`),

  // Segundo factor (TOTP)
  setup2fa: () => request('/2fa/setup', { method: 'POST' }),
  verify2fa: (code) => request('/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: (password) =>
    request('/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }),
};

// El OAuth son redirecciones del navegador: un fetch no puede seguirlas.
export function startOAuth(provider) {
  window.location.href = `${BASE}/oauth/${provider}/start`;
}
