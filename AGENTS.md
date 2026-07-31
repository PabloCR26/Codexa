# AGENTS.md

## Propósito

Este repositorio contiene exclusivamente `flowhub-api`, la API productora de FlowHub.
Es un proyecto universitario desarrollado por un equipo; los cambios deben ser claros,
pequeños y fáciles de explicar durante la defensa.

Lee `README.md` y `TAREAS.md` antes de modificar el proyecto.

## Límites del repositorio

Este repositorio es responsable de:

- API REST con Express.
- Registro, autenticación, sesiones y 2FA.
- CRUD de automatizaciones.
- OAuth con Google y GitHub.
- Recepción y validación de webhooks.
- Persistencia mediante PostgreSQL y Prisma.
- Publicación de trabajos en la cola BullMQ `executions`.
- Consulta de conexiones y bitácora de ejecuciones.

Este repositorio no contiene:

- La SPA React. Pertenece a `flowhub-web`.
- El consumidor BullMQ. Pertenece a `flowhub-worker`.
- La ejecución de acciones Gmail, GitHub o Telegram.
- Adaptadores de acciones de proveedores.
- Polling de Gmail o ejecución del scheduler, salvo endpoints o configuración que
  produzcan los trabajos correspondientes.

No agregues carpetas `web/`, `frontend/` ni `src/worker/`. Si una tarea requiere cambios
en otro repositorio, documenta el contrato necesario en lugar de implementar aquí ese código.

## Arquitectura obligatoria

La petición HTTP nunca debe ejecutar una acción externa de una automatización.

El flujo correcto es:

1. Validar autenticación, autorización y payload.
2. Verificar que el recurso pertenece al usuario.
3. Persistir el estado requerido.
4. Publicar un trabajo en Redis/BullMQ.
5. Responder rápidamente, normalmente con HTTP `202`.

La API y el worker se comunican únicamente por la cola `executions`. Todo cambio en el
nombre de la cola o en el payload es un cambio de contrato y debe documentarse.

## Stack y convenciones

- Node.js 20 o superior.
- CommonJS: usa `require` y `module.exports`.
- Express 4.
- Prisma 6 con PostgreSQL 16.
- BullMQ 5 e ioredis 5.
- Indentación de 2 espacios, UTF-8 y final de línea LF.
- Nombres de archivos en minúsculas; usa nombres descriptivos para routers y servicios.
- Mantén `src/api/index.js` como punto de composición. La lógica de negocio debe vivir
  en módulos separados, no dentro de los handlers.
- Centraliza Prisma, Redis y la cola en `src/shared/`; no crees clientes nuevos por petición.
- Devuelve JSON consistente y códigos HTTP adecuados.
- Usa `async/await` y propaga errores al middleware central.

## Seguridad y datos

- Nunca leas, escribas ni versiones secretos reales.
- `.env` no se versiona; actualiza `.env.example` cuando agregues una variable.
- Nunca devuelvas hashes, secretos TOTP ni tokens OAuth al cliente.
- Los tokens de proveedores deben cifrarse con AES-256-GCM antes de persistirse.
- Valida la firma HMAC de GitHub usando el cuerpo sin modificar.
- Valida el `state` de OAuth para prevenir CSRF.
- Toda consulta de información privada debe filtrar por `userId`.
- No aceptes un `userId` del body como fuente de identidad; usa la sesión autenticada.
- Protege login con rate limiting y las operaciones mutables con medidas CSRF.
- `express-session` MemoryStore solo es aceptable durante el arranque local; no lo
  presentes como una configuración lista para producción.

## Prisma y migraciones

El esquema fuente está en `prisma/schema.prisma`.

- No edites una migración que ya haya sido compartida o aplicada.
- Para cambiar el modelo, modifica el esquema y crea una migración nueva.
- Usa nombres de migración descriptivos.
- Conserva relaciones con borrado en cascada únicamente cuando el dominio lo justifique.
- Agrega índices para filtros frecuentes y restricciones únicas para idempotencia.
- El modelo `TriggerState` y el proveedor `TELEGRAM` son parte intencional del contrato.

Comandos:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name descripcion_del_cambio
npm run prisma:deploy
```

## Contrato de la cola

La API publica en `executions`; no consume esa cola.

Antes de cambiar un payload:

- Define campos obligatorios y opcionales.
- Incluye una versión explícita del contrato cuando empiece a evolucionar.
- No incluyas tokens descifrados ni secretos.
- Incluye un identificador estable del evento para idempotencia.
- Coordina el cambio con `flowhub-worker`.

Las opciones predeterminadas de reintento se encuentran en `src/shared/queue.js`.
La API no debe decidir qué errores de una acción externa son permanentes o reintentables;
esa clasificación pertenece al worker.

## API y compatibilidad con el frontend

Todas las rutas públicas viven bajo `/api`.

- Mantén `GET /api/health` sin autenticación.
- Las sesiones usan cookie HTTP-only.
- CORS debe admitir únicamente el origen configurado en `WEB_URL`.
- Los cambios de endpoints o respuestas deben comunicarse a `flowhub-web`.
- No agregues componentes React ni código de interfaz en este repositorio.

## Comandos de trabajo

```bash
npm ci
docker compose up -d --wait
npm run prisma:deploy
npm run dev
```

Validación mínima antes de entregar:

```bash
npx prisma validate
npm audit --audit-level=high
node --check src/api/index.js
```

Verifica también los archivos JavaScript modificados con `node --check`.
Si la tarea agrega pruebas, ejecútalas. Actualmente no existe una suite de tests:
no afirmes que “los tests pasan” sin haber agregado o encontrado una.

## Criterios de finalización

Antes de considerar completa una tarea:

- El cambio pertenece al alcance del backend.
- No hay secretos ni archivos `.env` versionados.
- Prisma valida y toda migración necesaria está incluida.
- La API arranca y `/api/health` responde.
- Los errores tienen respuesta JSON y no filtran información sensible.
- Las consultas privadas están limitadas por `userId`.
- Se actualizó `.env.example` y/o `README.md` si cambió la configuración.
- Se documentó cualquier cambio contractual para frontend o worker.
- `git diff --check` no reporta errores.

No hagas commits ni pushes salvo que el usuario lo solicite explícitamente.
