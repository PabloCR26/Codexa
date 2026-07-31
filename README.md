# FlowHub API — Proyecto 02

**Aplicaciones Web Utilizando Software Libre (ISW-811)**

- **Estudiantes:** Edgar Eliam Araya Alvarado · Jose Pablo Chavez Madriz · Robert
- **Docente:** Misael Matamoros Soto
- **Fecha:** 24/07/2026

Backend de FlowHub, una plataforma de automatización personal donde el usuario define reglas
del tipo “cuando ocurra X, haz Y”.

Este repositorio contiene **únicamente la API productora**. El frontend y el worker se
desarrollan y despliegan desde repositorios independientes.

## Repositorios de la solución

| Repositorio | Responsabilidad | Tecnología |
|---|---|---|
| `flowhub-api` (este repositorio) | API REST, autenticación, OAuth, webhooks, CRUD y publicación de trabajos | Express + Prisma + BullMQ |
| `flowhub-web` | Interfaz SPA que consume la API | React + Vite |
| `flowhub-worker` | Consume trabajos y ejecuta acciones de proveedores | Node.js + BullMQ |

Los nombres `flowhub-web` y `flowhub-worker` son sugeridos; deben sustituirse por las URLs
reales cuando se creen esos repositorios.

## Arquitectura

Principio central: **la API no ejecuta acciones externas dentro de una petición HTTP**.
Valida la solicitud, persiste el estado necesario, publica un trabajo en Redis y responde.
El worker independiente consume posteriormente ese trabajo.

```text
flowhub-web
    │ REST + cookie de sesión
    ▼
flowhub-api (este repo) ◄── webhooks GitHub / configuración del usuario
    │ publica trabajos
    ▼
Redis + BullMQ
    │ consume trabajos
    ▼
flowhub-worker ──► Gmail / GitHub / Telegram
    │
    ▼
PostgreSQL ◄──── flowhub-api
```

### Contratos entre repositorios

- **Frontend → API:** HTTP JSON bajo `/api`, con cookies y `credentials: "include"`.
- **API → worker:** cola BullMQ `executions` en la instancia definida por `REDIS_URL`.
- **API ↔ base de datos:** PostgreSQL mediante Prisma.
- **Worker ↔ base de datos:** el worker debe usar el mismo modelo de datos y `DATABASE_URL`.
- **Adaptadores del worker:** firma acordada
  `async ({ params, connection, context }) => resultado`.

Los tres repositorios deben acordar y versionar el formato del payload de la cola antes de
implementar las acciones. Un cambio incompatible debe coordinarse entre API y worker.

## Alcance actual

Esta base deja preparado:

- Express con seguridad básica, CORS, sesiones y manejo central de errores.
- Endpoint de salud `GET /api/health`.
- Routers reservados para `auth`, `automations`, `webhooks`, `oauth`, `connections`,
  `executions` y `2fa`.
- Publicador BullMQ para la cola `executions`, con reintentos y backoff predeterminados.
- PostgreSQL 16 y Redis 7 para desarrollo con Docker Compose.
- Esquema y migración inicial de Prisma.
- Proveedores `GOOGLE`, `GITHUB` y `TELEGRAM`.
- Modelo `TriggerState` para conservar el cursor del polling de Gmail.

Las rutas reservadas responden `501 NOT_IMPLEMENTED` hasta que el equipo implemente cada fase.

## Estructura del repositorio

```text
.
├── docker-compose.yml
├── .env.example
├── package.json
├── package-lock.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── api/
    │   ├── index.js
    │   └── routes/
    ├── shared/
    │   ├── prisma.js
    │   ├── queue.js
    │   └── redis.js
    └── config.js
```

## Instalación local

### Requisitos

- Node.js 20 LTS o superior y npm.
- Docker Desktop con contenedores Linux y el motor iniciado.
- Git.

Comprobar las versiones:

```bash
node --version
npm --version
docker --version
docker compose version
docker info
```

`docker info` debe mostrar las secciones `Client` y `Server`. En Windows, si el comando
indica que no encuentra `dockerDesktopLinuxEngine`, iniciar Docker Desktop desde el menú
Inicio o ejecutar `docker desktop start`, esperar y volver a probar.

### 1. Clonar el backend

```bash
git clone <url-del-repositorio-backend>
cd Codexa
```

### 2. Instalar dependencias

El lockfile está versionado para que todos usen las mismas versiones:

```bash
npm ci
```

### 3. Configurar el entorno

macOS/Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Generar los secretos:

```bash
# 64 caracteres hexadecimales
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# secreto largo para las sesiones
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Copiar esos resultados en `TOKEN_ENCRYPTION_KEY` y `SESSION_SECRET` dentro de `.env`.
Las credenciales OAuth pueden permanecer vacías hasta desarrollar las integraciones.

La configuración local usa el puerto `5433` para PostgreSQL, evitando conflictos con una
instalación nativa que use el puerto convencional `5432`. Dentro del contenedor PostgreSQL
continúa escuchando en `5432`; no hay que cambiar esa parte.

### 4. Levantar PostgreSQL y Redis

```bash
docker compose up -d --wait
docker compose ps
docker compose port postgres 5432
```

Ambos servicios deben aparecer como `healthy`. El último comando debe mostrar que PostgreSQL
está publicado en el puerto `5433`, por ejemplo `0.0.0.0:5433`.

### 5. Aplicar la base de datos

```bash
npm run prisma:deploy
npm run prisma:generate
```

`prisma:deploy` debe indicar que aplicó la migración inicial o que no hay migraciones
pendientes. `prisma:generate` puede mostrar un aviso sobre una nueva versión mayor de Prisma;
no es necesario actualizarla para instalar el proyecto.

### 6. Ejecutar la API

```bash
npm run dev
```

La API queda disponible en http://localhost:4000. Verificar:

```bash
curl http://localhost:4000/api/health
```

Respuesta esperada:

```json
{"status":"ok","service":"flowhub-api"}
```

En PowerShell también se puede usar:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

## Conexión desde los otros repositorios

### Frontend

El frontend local debe usar:

```env
VITE_API_URL=http://localhost:4000/api
```

Las peticiones que dependan de la sesión deben incluir credenciales. La URL donde corre el
frontend debe coincidir con `WEB_URL` en el `.env` de este backend; por defecto es
`http://localhost:5173`.

### Worker

El worker debe configurar las mismas conexiones:

```env
DATABASE_URL=postgresql://flowhub:flowhub@127.0.0.1:5433/flowhub?schema=public
REDIS_URL=redis://127.0.0.1:6379
```

Debe consumir la cola `executions`. Este backend solo publica trabajos; no inicia ni incorpora
el consumidor.

## Variables de entorno

| Variable | Obligatoria para arrancar | Uso |
|---|---:|---|
| `PORT` | No | Puerto HTTP, por defecto `4000` |
| `WEB_URL` | No | Origen permitido por CORS |
| `PUBLIC_URL` | Más adelante | URL pública para callbacks y webhooks |
| `POSTGRES_PORT` | No | Puerto de PostgreSQL en el host, por defecto `5433` |
| `REDIS_PORT` | No | Puerto de Redis en el host, por defecto `6379` |
| `DATABASE_URL` | Sí | Conexión PostgreSQL |
| `REDIS_URL` | Sí | Redis compartido con el worker |
| `SESSION_SECRET` | Sí | Firma de la sesión |
| `TOKEN_ENCRYPTION_KEY` | Para OAuth | Cifrado AES-256 de tokens |
| `GOOGLE_*` | Para OAuth Google | Credenciales y callback |
| `GITHUB_*` | Para OAuth/webhooks | Credenciales, callback y firma |
| `TELEGRAM_BOT_TOKEN` | En el worker | Ejecución de acciones Telegram |

Aunque la plantilla enumera `TELEGRAM_BOT_TOKEN` para documentar la solución, el token deberá
configurarse en el repositorio del worker y no ser utilizado por esta API.

## Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm start` | API sin recarga |
| `npm run prisma:generate` | Generar Prisma Client |
| `npm run prisma:migrate -- --name descripcion` | Crear una migración |
| `npm run prisma:deploy` | Aplicar migraciones versionadas |
| `npm run prisma:studio` | Explorar la base de datos |

## Webhooks durante el desarrollo

Exponer el puerto de la API y copiar la URL pública en `PUBLIC_URL`:

```bash
ngrok http 4000
# o
cloudflared tunnel --url http://localhost:4000
```

Callback Google:

```text
http://localhost:4000/api/oauth/google/callback
```

Callback GitHub:

```text
http://localhost:4000/api/oauth/github/callback
```

Webhook GitHub:

```text
PUBLIC_URL/api/webhooks/github/<automationId>
```

## Solución de problemas

- Si `docker` existe pero no conecta con `dockerDesktopLinuxEngine`, iniciar Docker Desktop
  con `docker desktop start` y esperar a que `docker info` muestre la sección `Server`.
- Si Prisma no alcanza PostgreSQL, confirmar que `docker compose ps` muestre `healthy` y
  revisar el puerto real con `docker compose port postgres 5432`.
- Si Prisma muestra `P1000`, comprobar que `DATABASE_URL` coincida con usuario, contraseña
  y puerto de `.env`. También ejecutar `unset DATABASE_URL` en Git Bash para eliminar una
  variable antigua que pueda tener prioridad sobre el archivo.
- Si Prisma muestra `P1001`, el puerto de `DATABASE_URL` no coincide con el publicado por
  Docker Compose.
- Si la API indica variables faltantes, confirmar que `.env` existe en la raíz.
- Si el frontend recibe un error CORS, revisar que su origen coincida exactamente con `WEB_URL`.
- Si el worker no recibe trabajos, comparar `REDIS_URL` y el nombre de cola en ambos repositorios.
- Si el puerto `5433` está ocupado, cambiar `POSTGRES_PORT` y el puerto de `DATABASE_URL`
  al mismo valor. No modificar el puerto interno `5432` del contenedor.

Comprobar las credenciales dentro del contenedor:

```bash
docker exec -e PGPASSWORD=flowhub flowhub-postgres \
  psql -h 127.0.0.1 -U flowhub -d flowhub -c "SELECT 1;"
```

Para detener la infraestructura sin borrar datos:

```bash
docker compose down
```

`docker compose down -v` elimina permanentemente los datos locales.

## Reglas de colaboración

- Ningún secreto se versiona; solo `.env.example`.
- Las migraciones de Prisma se crean y versionan desde este repositorio.
- Los cambios al payload de `executions` se coordinan con el equipo del worker.
- Los cambios de endpoints se coordinan con el equipo del frontend.
- Cada integrante trabaja en una rama por tarea y realiza commits con su propia cuenta.
