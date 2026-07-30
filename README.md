# FlowHub — Proyecto 02

**Aplicaciones Web Utilizando Software Libre (ISW-811)**

- **Estudiantes:** Edgar Eliam Araya Alvarado · Jose Pablo Chavez Madriz
- **Docente:** Misael Matamoros Soto
- **Fecha:** 24/07/2026

Plataforma de automatización personal: el usuario conecta sus servicios y define reglas
"cuando ocurra X, haz Y", que se ejecutan de forma asíncrona mediante un broker de mensajería.

## Arquitectura

Principio clave: **la aplicación web no ejecuta las acciones dentro de la petición HTTP.**
Publica un trabajo en el broker y responde de inmediato; un **worker independiente** consume
la cola y ejecuta la cadena de acciones.

```
SPA (React)
   │  REST + cookie de sesión
   ▼
API · Express (Productor)      ◄── Disparadores: webhook GitHub · polling Gmail · cron
   │  publica job
   ▼
Redis + BullMQ (Broker)        colas: executions · dead-letter (DLQ)
   │  consume
   ▼
Worker · proceso Node aparte   ──► Acciones: Gmail · GitHub · Telegram (patrón adaptador)
   │  persiste estado
   ▼
PostgreSQL + Prisma            usuarios · tokens cifrados (AES-256-GCM) · automatizaciones · bitácora
```

### Flujo de una automatización

1. Se dispara el evento (webhook de GitHub, o job programado por cron / polling de Gmail).
2. La API valida, arma el payload del disparador, lo publica en Redis y responde sin ejecutar nada más.
3. El worker consume el trabajo, evalúa las condiciones y resuelve el mapeo de datos `{{trigger.campo}}`.
4. Ejecuta la cadena de acciones, una a la vez, vía adaptadores por proveedor, respetando límites de tasa.
5. Registra entrada, salida y errores en la bitácora; ante fallo reintenta con backoff y, si se agota, deriva a la DLQ.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite (SPA) |
| API | Express 4 (Node 20+) — productor |
| Broker | Redis + BullMQ |
| Worker | Proceso Node independiente — consumidor |
| Base de datos | PostgreSQL 16 + Prisma |
| Auth | express-session + bcryptjs (cookie httpOnly) · 2FA opcional (otplib) |
| OAuth | Authorization Code Flow con patrón adaptador · tokens cifrados |
| Dev | cloudflared / ngrok (túnel para webhooks) |

**Proveedores:** OAuth delegado con **Google** y **GitHub**; **Telegram** como canal de acción adicional.

## Estructura del proyecto

```
.
├── docker-compose.yml        # PostgreSQL + Redis
├── .env.example              # Plantilla de variables de entorno (copiar a server/.env)
├── server/                   # Backend (API productor + worker consumidor)
│   ├── prisma/schema.prisma  # Modelo de datos
│   └── src/
│       ├── api/              # Express: rutas auth, automations, webhooks
│       ├── worker/           # Consumidor BullMQ
│       └── shared/           # prisma, redis, queue, crypto, template, engine, adapters/
└── web/                      # Frontend React + Vite (SPA)
```

## Instalación (zona de trabajo)

### Requisitos previos

- **Node.js 20+** y **npm** — https://nodejs.org
- **Docker Desktop** (para PostgreSQL y Redis) — https://www.docker.com/products/docker-desktop/
  - *Alternativa sin Docker:* instalar PostgreSQL 16 y Redis nativos y ajustar `DATABASE_URL` / `REDIS_URL`.
- **Git** — https://git-scm.com

### Pasos

**1. Clonar el repositorio**

```bash
git clone <url-del-repo>
cd ISW811-Codexa-Proyecto02
```

**2. Levantar la infraestructura (PostgreSQL + Redis)**

```bash
docker compose up -d
```

**3. Configurar las variables de entorno**

```bash
cp .env.example server/.env
```

Editar `server/.env` y completar los valores. Generar las llaves con:

```bash
# TOKEN_ENCRYPTION_KEY (64 caracteres hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET (cadena aleatoria larga)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Los `CLIENT_ID` / `CLIENT_SECRET` de Google y GitHub se obtienen registrando la app en cada proveedor
(ver sección siguiente).

**4. Instalar dependencias y preparar la base de datos**

```bash
# Backend
cd server
npm install
npx prisma migrate dev --name init   # crea las tablas
cd ..

# Frontend
cd web
npm install
cd ..
```

## Ejecución

Se necesitan **tres procesos**, cada uno en su propia terminal:

```bash
# Terminal 1 — API (productor)
cd server && npm run dev:api        # http://localhost:4000

# Terminal 2 — Worker (consumidor)
cd server && npm run dev:worker

# Terminal 3 — Frontend (SPA)
cd web && npm run dev               # http://localhost:5173
```

Abrir http://localhost:5173: debe mostrar **"✅ API conectada"**.

### Webhooks en desarrollo (túnel)

Para recibir los webhooks de GitHub, exponer el puerto 4000 con un túnel y copiar la URL pública en `PUBLIC_URL`:

```bash
ngrok http 4000
# o
cloudflared tunnel --url http://localhost:4000
```

## Registro de las apps ante los proveedores

Cada proveedor entrega un **Client ID** y **Client Secret** que van en `server/.env` (nunca en Git).

- **Google:** [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → Credenciales → *OAuth client ID* (tipo *Web application*). Redirect URI: `http://localhost:4000/api/oauth/google/callback`. Habilitar la *Gmail API*.
- **GitHub:** [Developer settings](https://github.com/settings/developers) → *OAuth Apps* → *New OAuth App*. Authorization callback URL: `http://localhost:4000/api/oauth/github/callback`. El webhook del repositorio apunta a `PUBLIC_URL/api/webhooks/github/<automationId>` con el `GITHUB_WEBHOOK_SECRET`.
- **Telegram:** hablar con [@BotFather](https://t.me/BotFather) → `/newbot` para obtener el `TELEGRAM_BOT_TOKEN`.

## Scripts útiles

| Comando (en `server/`) | Acción |
|---|---|
| `npm run dev:api` | API con recarga automática |
| `npm run dev:worker` | Worker con recarga automática |
| `npm run prisma:studio` | Explorar la base de datos en el navegador |
| `npm run prisma:migrate` | Crear/aplicar migraciones |

## Notas

- Los procesos `api` y `worker` se ejecutan y despliegan por separado; se comunican solo vía broker.
- Secretos fuera del control de versiones (`.env` + `.env.example`).
- Repositorio en GitLab privado, iniciado desde el primer día.
- `web/`: react-router-dom fijado en 7.18.2 (última estable). Las alertas de `npm audit` restantes son del modo **RSC**, que no se usa en este SPA cliente.
