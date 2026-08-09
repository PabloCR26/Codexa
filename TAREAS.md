# Lista de tareas — FlowHub (Proyecto 02)

Equipo de 3 integrantes (autorizado por el docente): Eliam · Jose Pablo · Robert

Las tareas están en **orden de construcción**: cada fase se apoya en la anterior.
Marcar con `[x]` lo que se vaya completando.

---

## Fase 1 — Preparar el entorno

- [ ] **1.** Instalar Docker Desktop y Node 20+ en las tres máquinas.
- [ ] **2.** Migrar el repositorio a **GitLab privado** y agregar a los 3 como miembros.
- [x] **3.** Levantar la infraestructura: `docker compose up -d` (PostgreSQL + Redis).
- [x] **4.** Copiar `.env.example` a `.env` y generar `SESSION_SECRET` y `TOKEN_ENCRYPTION_KEY`.
- [x] **5.** Completar `.env.example` con todas las variables que usará el proyecto.
- [x] **6.** Corregir el enum `Provider` en `schema.prisma`: agregar `TELEGRAM`
  (hoy solo tiene `GOOGLE` y `GITHUB`, pero las acciones usan Telegram y falla en silencio).
- [x] **7.** Agregar al esquema un modelo `TriggerState` para el cursor del polling de Gmail
  (guardar el último correo procesado y no reprocesarlo).
- [x] **8.** Correr la migración: `npx prisma migrate dev --name init` y commitearla.
- [x] **9.** Registrar en `api/index.js` los routers que faltan, aunque estén vacíos:
  `/api/oauth`, `/api/connections`, `/api/executions`, `/api/2fa`.
- [x] **10.** En `web/src/JS/api.js`, definir todas las llamadas HTTP y dejar el router
  con todas las páginas apuntando a componentes vacíos.
- [ ] **11.** Acordar la firma exacta de los adaptadores:
  `async ({ params, connection, context }) => resultado`.
- [ ] **12.** Verificar que arranquen los tres procesos: `dev:api`, `dev:worker` y `dev:web`.

## Fase 2 — Autenticación y espacio privado

- [x] **13.** Probar registro, login y logout con Postman o `curl`; corregir lo que falle.
- [x] **14.** Revisar que **toda** consulta filtre por `userId`; probar con dos usuarios
  que ninguno vea los datos del otro.
- [x] **15.** UI de registro: formulario, validación y manejo de errores.
- [x] **16.** UI de login con redirección si ya existe sesión.
- [x] **17.** Componente de ruta protegida: sin sesión, redirige a login.
- [x] **18.** Layout con navegación: Automatizaciones · Conexiones · Historial · Salir.
- [x] **19.** Protección CSRF y revisión de las opciones de la cookie de sesión.
- [x] **20.** Limitar intentos de login (rate limiting) contra fuerza bruta.

## Fase 3 — Conexiones OAuth

- [x] **21.** Registrar la OAuth App en **GitHub**; guardar Client ID/Secret en `.env`.
- [x] **22.** `GET /api/oauth/github/start`: generar `state` anti-CSRF, guardarlo en sesión
  y redirigir con los scopes mínimos.
- [x] **23.** `GET /api/oauth/github/callback`: validar `state`, intercambiar el código
  por el token y guardarlo **cifrado**.
- [x] **24.** Verificar en `npm run prisma:studio` que el token está ilegible en la base
  (evidencia del cifrado en reposo).
- [x] **25.** Registrar la app en **Google Cloud Console**, habilitar la Gmail API y
  configurar la pantalla de consentimiento y los scopes.
- [x] **26.** `GET /api/oauth/google/start` con `access_type=offline` para obtener refresh token.
- [x] **27.** `GET /api/oauth/google/callback`: guardar access + refresh cifrados y `expiresAt`.
- [x] **28.** Función de **refresco automático**: renovar el token vencido antes de usarlo
  y guardar el nuevo.
- [x] **29.** `GET /api/connections`: listar las conexiones del usuario sin exponer tokens.
- [x] **30.** `DELETE /api/connections/:id`: revocar ante el proveedor y borrar de la base.
- [x] **31.** UI de conexiones: tarjeta por proveedor con estado, botón *Conectar* y *Revocar*.

## Fase 4 — Gestión de automatizaciones (CRUD)

> Los endpoints de la API (`GET`, `POST`, `PUT`, `PATCH /toggle`, `DELETE`) ya están
> implementados y filtrados por `userId`; se hicieron junto con la tarea 14.
> Las tareas de esta fase son la interfaz que los consume.

- [x] **32.** UI de lista con botones de activar/desactivar y eliminar.
- [x] **33.** Formulario de creación: nombre, tipo de disparador y su configuración.
- [x] **34.** Editor de acciones: agregar, quitar y ordenar; elegir proveedor y tipo de acción.
- [x] **35.** Campos de parámetros con plantillas `{{trigger.campo}}`.
- [x] **36.** Editor de condiciones: campo, operador y valor.
- [x] **37.** Formulario de edición y manejo de errores de validación.

## Fase 5 — Catálogo de acciones (3 acciones, 3 proveedores)

- [x] **38.** Crear el bot con @BotFather, obtener el `TELEGRAM_BOT_TOKEN` y probar la
  acción `send_message` (ya implementada) de punta a punta.
- [x] **39.** Acción **GitHub** `create_issue`: `POST /repos/{owner}/{repo}/issues`
  con el token del usuario.
- [x] **40.** Acción **Gmail** `send_email`: `users.messages.send` con el mensaje MIME
  codificado en base64url.
- [x] **41.** Clasificar los errores de cada adaptador: 429 y 5xx **reintentables**,
  4xx **permanentes**.

## Fase 6 — Motor asíncrono y disparadores

- [X] **42.** Arrancar el worker y confirmar que conecta a Redis.
- [X] **43.** Script que encole un job manualmente y verificar que el worker lo consume.
- [X] **44.** Revisar `engine.js`: que ejecute las acciones **en orden** y registre la ejecución.
- [X] **45.** Levantar el túnel (`ngrok http 4000`) y configurar el webhook en un repo de prueba.
- [X] **46.** Probar la validación de firma HMAC del webhook, incluyendo una firma inválida.
- [X] **47.** Confirmar que la API **encola y responde 202 sin ejecutar la acción**
  (requisito arquitectónico central; dejarlo como demo para la defensa).
- [X] **48.** Extraer los datos del evento al `triggerData` que consumen las plantillas.
- [X] **49.** Proceso `scheduler`: registrar **repeatable jobs** de BullMQ según la expresión
  cron que define el usuario.
- [X] **50.** Sincronizar los jobs programados cuando una automatización se crea, edita,
  activa o desactiva.
- [ ] **51.** Disparador de **sondeo de Gmail** (NO implementado: el archivo es un esqueleto): consultar correos nuevos usando el cursor
  de `TriggerState`.

## Fase 7 — Robustez del procesamiento

- [x] **52.** **Idempotencia:** encolar dos veces el mismo evento y demostrar que la acción
  se ejecuta una sola vez.
- [x] **53.** **Reintentos con backoff:** provocar un fallo transitorio y ver en los logs
  los reintentos espaciándose exponencialmente.
- [x] **54.** **DLQ:** provocar un fallo permanente y verificar que el job cae en la cola de
  fallidos y la ejecución queda como `FAILED`.
- [x] **55.** Respetar *rate limits*: usar el `Retry-After` del proveedor y limitar la
  concurrencia del worker.

## Fase 8 — Condiciones y bitácora

- [X] **56.** Probar los operadores de condiciones (`eq`, `neq`, `contains`, `gt`, `lt`)
  y que detengan la automatización cuando no se cumplen.
- [X] **57.** Probar la interpolación de plantillas, con campos anidados e inexistentes.
- [X] **58.** `GET /api/executions`: historial del usuario con filtro por estado y paginación.
- [X] **59.** `GET /api/executions/:id`: detalle con entrada, salida y error.
- [x] **60.** UI de bitácora: tabla con estado, fecha y automatización, más vista de detalle.
  Deben verse **pendientes, exitosas y fallidas**.

## Fase 9 — Puntos opcionales

- [ ] **61.** `POST /api/2fa/setup`: generar el secreto TOTP y devolver el QR.
- [ ] **62.** `POST /api/2fa/verify`: validar el código y activar `totpEnabled`.
- [ ] **63.** `POST /api/2fa/disable` con confirmación de contraseña.
- [ ] **64.** Modificar el login: si `totpEnabled`, exigir el OTP antes de crear la sesión.
- [ ] **65.** UI de activación de 2FA: mostrar QR, campo de código y estado actual.
- [ ] **66.** Filtros avanzados: operadores lógicos (AND/OR) y agrupación de condiciones.

## Fase 10 — Cierre y defensa

- [ ] **67.** Completar el README: instalación, configuración de Client ID/Secret,
  levantamiento del broker y ejecución de la app web y del worker.
- [ ] **68.** Diagrama de arquitectura para el README y la defensa.
- [ ] **69.** Revisar que **ningún secreto** quedó versionado en el historial de Git.
- [ ] **70.** Verificar que los tres integrantes tienen commits sustantivos.
- [ ] **71.** Preparar las tres demos clave: **idempotencia**, **backoff** y **DLQ**.
- [ ] **72.** Ensayo de defensa: cada integrante debe poder explicar toda la solución.

---

## Reglas de trabajo

- Una rama por tarea, nombrada con su número: `feat/23-oauth-github-callback`.
- Cada integrante commitea con **su propia cuenta**: la rúbrica evalúa aportes individuales.
- Hacer `pull` antes de empezar cada tarea.
- Avisar al grupo antes de tocar archivos compartidos o contratos entre repositorios:
  `prisma/schema.prisma`, `src/api/index.js`, el cliente HTTP del frontend, el payload
  de la cola `executions` y `.env.example`.
- **Ningún secreto en Git.** Solo se versiona `.env.example`.
