# CLAUDE.md

## Contexto del proyecto

FlowHub es una plataforma universitaria de automatización personal: el usuario conecta
servicios y crea reglas “cuando ocurra X, haz Y”. La arquitectura es asíncrona.

Este repositorio contiene toda la solución. Antes de trabajar, lee `README.md`,
`TAREAS.md` y `AGENTS.md`.

Se organiza en tres componentes que comparten repositorio pero son procesos distintos:

1. `src/api/`: Express, Prisma y publicación BullMQ (productor).
2. `src/worker/`: consumidor BullMQ y ejecución de acciones.
3. `web/`: SPA React/Vite.

## Regla arquitectónica principal

La API nunca ejecuta Gmail, GitHub o Telegram durante una petición HTTP. Debe validar,
persistir, publicar en la cola `executions` y responder. El worker, como proceso separado,
consume el trabajo y ejecuta las acciones.

Compartir repositorio no significa mezclar procesos: la API y el worker deben poder
arrancarse y desplegarse por separado, y comunicarse solo a través de Redis. No importes
código de `src/worker/` desde `src/api/` ni al revés; lo común vive en `src/shared/`.

## Tecnologías

- Node.js 20+ con CommonJS.
- Express 4.
- PostgreSQL 16 y Prisma 6.
- Redis 7, BullMQ 5 e ioredis 5.
- Sesiones mediante cookie HTTP-only.

## Mapa del código

```text
src/config.js                 carga y valida el entorno
src/api/index.js              composición y arranque de Express
src/api/routes/               routers HTTP
src/worker/index.js           consumidor BullMQ y derivación a la DLQ
src/worker/engine.js          motor de ejecución de automatizaciones
src/shared/prisma.js          PrismaClient compartido
src/shared/redis.js           fábrica de conexión Redis
src/shared/queue.js           colas executions y executions-dlq
prisma/schema.prisma          modelo de datos
prisma/migrations/            historial inmutable de migraciones
web/                          SPA React/Vite con su propio package.json
```

Mantén los handlers pequeños. Separa rutas, middleware, validadores, servicios y repositorios
cuando se implemente cada módulo. No concentres la lógica de negocio en `src/api/index.js`.

## Reglas de implementación

- Usa `require`, `module.exports` y `async/await`.
- Usa 2 espacios, UTF-8 y nombres descriptivos.
- Todas las rutas viven bajo `/api`.
- Mantén `GET /api/health` público.
- Reutiliza los clientes compartidos; no abras Prisma o Redis por petición.
- Entrega respuestas JSON y códigos HTTP semánticos.
- Envía errores asíncronos al middleware central.
- No cambies el nombre o payload de `executions` sin documentar y coordinar el contrato.
- No añadas dependencias sin justificar su necesidad y revisar `npm audit`.

## Seguridad

- Nunca versiones `.env` ni secretos.
- Toda nueva variable debe aparecer sin valor sensible en `.env.example`.
- Obtén la identidad desde la sesión, nunca desde un `userId` enviado por el cliente.
- Filtra todas las consultas privadas por `userId`.
- Nunca expongas `passwordHash`, secretos TOTP ni tokens.
- Cifra los tokens OAuth con AES-256-GCM.
- Valida `state` OAuth, firmas de webhooks, entradas y permisos.
- Agrega protección CSRF y rate limiting en los flujos correspondientes.
- MemoryStore de `express-session` es solo para desarrollo local.

## Base de datos

Modifica `prisma/schema.prisma` y crea una migración nueva; no alteres migraciones aplicadas.
Conserva `Provider.TELEGRAM` y `TriggerState`, pues resuelven requisitos conocidos.
Usa restricciones e índices para aislamiento por usuario e idempotencia.

```bash
npm run prisma:migrate -- --name descripcion_del_cambio
npm run prisma:generate
```

## Desarrollo y verificación

Instalación:

```bash
npm ci
docker compose up -d --wait
npm run prisma:deploy
npm run dev
```

Antes de entregar:

```bash
npx prisma validate
npm audit --audit-level=high
git diff --check
```

Ejecuta `node --check` sobre cada JavaScript modificado y comprueba:

```bash
curl http://localhost:4000/api/health
```

El proyecto aún no tiene suite automatizada. No indiques que las pruebas pasan si no existen.

## Forma de colaborar

- Respeta el alcance de la tarea y los cambios existentes del equipo.
- Una rama por tarea, siguiendo la numeración de `TAREAS.md`.
- No hagas commits ni pushes salvo petición explícita.
- Explica decisiones que afecten contratos, seguridad o datos.
- Actualiza README y `.env.example` cuando cambie la instalación.
- Señala claramente cuando un cambio afecte también a `src/worker/` o a `web/`.
