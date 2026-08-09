# Guía de pruebas — FlowHub

Cómo comprobar que cada parte funciona. Sirve para verificar el trabajo propio
y para preparar la defensa.

## Antes de empezar

Levantar la infraestructura:

```bash
docker compose up -d --wait
```

Y la aplicación. Dos opciones, **nunca las dos a la vez** (se pelean por el puerto 4000):

**Opción A — Docker (lo que se muestra en la defensa):**

```bash
docker compose --profile app up -d --build
```

La web queda en http://localhost:8080

**Opción B — local (para desarrollar, recarga al guardar):**

```bash
docker compose stop api worker web
```

Después, en tres terminales: `npm run dev:api`, `npm run dev:worker`, `npm run dev:web`.
La web queda en http://localhost:5173

> Si al levantar Docker aparece `bind: Solo se permite un uso de cada dirección`,
> hay un proceso local ocupando el 4000. Cerralo primero.

---

## 1. Pruebas automatizadas

La comprobación más rápida y completa:

```bash
npm test
```

Deben pasar **todas**, sin fallos. Cubren: registro y cifrado de contraseñas,
aislamiento del CRUD por usuario, validaciones, cifrado de tokens, URLs de OAuth,
operadores de condiciones, interpolación de plantillas y el registro de adaptadores.

Para correr solo un archivo:

```bash
node --test test/engine-conditions.test.js
```

---

## 2. Autenticación y espacio privado

**Registro, sesión y cierre** (Postman o `curl`):

| Paso | Petición | Esperado |
|---|---|---|
| 1 | `POST /api/auth/register` | 201 |
| 2 | `GET /api/auth/me` | 200 |
| 3 | `POST /api/auth/logout` | 204 |
| 4 | `GET /api/auth/me` | **401** |
| 5 | `POST /api/auth/login` | 200 |

Con contraseña incorrecta y con un correo inexistente debe responder **el mismo
error** (`INVALID_CREDENTIALS`), para no revelar qué correos están registrados.

**Aislamiento entre usuarios:** creá dos cuentas, una automatización con la
primera, y desde la segunda intentá leerla, editarla, desactivarla y borrarla con
su identificador. Las cuatro deben dar **404** (no 403: un 403 confirmaría que
ese identificador existe).

**Contraseñas cifradas:** `npm run prisma:studio` → tabla `User` → `passwordHash`
debe verse como `$2b$12$...`, ilegible.

**CSRF:** un `POST` sin la cabecera `X-CSRF-Token` debe dar **403**. El token se
pide en `GET /api/csrf-token`.

---

## 3. Conexiones OAuth

Desde la web, en **Conexiones**, conectar Google y GitHub.

**Tokens cifrados en reposo:** `npm run prisma:studio` → tabla `Connection` →
`accessTokenEncrypted` debe empezar con `v1:` y ser ilegible. Nunca debe verse el
token original.

También sin mostrar los valores:

```bash
npm run oauth:verify-storage
```

> Telegram **no** aparece en Conexiones: no usa OAuth, sino un token de bot
> global en el `.env`.

---

## 4. Cómo llenar una automatización

Los ejemplos siguientes son los que sirven para las pruebas de más abajo. Se
crean desde **Automatizaciones → Nueva automatización**.

El **identificador** de una automatización aparece en la barra de direcciones al
editarla: `/automations/cmXXXXXXXX`. Hace falta para dispararla y para armar la
URL de su webhook.

### a) Para probar condiciones (termina *Omitida*)

| Sección | Campo | Valor |
|---|---|---|
| General | Nombre | `Prueba de condición` |
| Cuando ocurra | Disparador | Webhook de GitHub |
| | Propietario / Repositorio | tu usuario y un repo tuyo |
| | Evento | Issues |
| **Solo si** | Campo | `action` |
| | Operador | `eq` (igual a) |
| | Valor | `jamas-coincide` |
| Acción | Proveedor / Tipo | Telegram · Enviar mensaje |
| | Chat ID | `1` |
| | Mensaje | `Issue: {{trigger.title}}` |

La condición nunca se cumple, así que la acción no llega a ejecutarse. No hace
falta que Telegram esté configurado.

### b) Para probar plantillas (termina *Exitosa*)

Necesita Google conectado en **Conexiones**.

| Sección | Campo | Valor |
|---|---|---|
| General | Nombre | `Prueba de plantilla` |
| Cuando ocurra | Disparador | Webhook de GitHub |
| **Solo si** | — | **sin condiciones** |
| Acción | Proveedor / Tipo | Gmail · Enviar correo |
| | Destinatario | tu propio correo |
| | Asunto | `Nuevo issue: {{trigger.title}}` |
| | Mensaje | `Abierto por {{trigger.sender}} en {{trigger.repository}}` |

Campos disponibles para plantillas: `event`, `action`, `repository`, `title`,
`sender`, `url`. Uno que no exista se reemplaza por vacío.

> La variante con GitHub · **Crear issue** también sirve, y el resultado queda
> visible en el repositorio. Conviene apuntarla a un repo **distinto** del que
> dispara, o se llamaría a sí misma en bucle.

### c) Para probar fallos, reintentos y DLQ (termina *Fallida*)

| Sección | Campo | Valor |
|---|---|---|
| General | Nombre | `Prueba de fallo` |
| Cuando ocurra | Disparador | Webhook de GitHub |
| **Solo si** | — | sin condiciones |
| Acción | Proveedor / Tipo | Telegram · Enviar mensaje |
| | Chat ID | **vacío** |
| | Mensaje | `x` |

El comportamiento depende de si hay bot configurado:

| `TELEGRAM_BOT_TOKEN` | Error | Resultado |
|---|---|---|
| Vacío | `MISSING_TOKEN` (500) | **3 intentos** con retroceso, luego DLQ |
| Configurado | `MISSING_CHAT_ID` (400) | **1 intento**, directo a la DLQ |

Sirve para las dos pruebas de la sección 7.

### d) Para probar el disparador por tiempo

| Sección | Campo | Valor |
|---|---|---|
| General | Nombre | `Prueba de cron` |
| Cuando ocurra | Disparador | Programado (cron) |
| | Expresión | `*/5 * * * *` |
| Acción | cualquiera | — |

---

## 5. Disparar una automatización sin internet

Para probar el motor sin depender de GitHub:

```bash
npm run enqueue:test-job <ID_AUTOMATIZACION> <ID_EVENTO>
```

El identificador de la automatización aparece en la barra de direcciones al
editarla: `/automations/cmXXXXXXXX`.

El script imita los datos de un webhook real. Los campos disponibles para
plantillas son: `event`, `action`, `repository`, `title`, `sender`, `url`.

---

## 5. Webhook real de GitHub

Es la demo principal. Necesita un túnel porque GitHub debe alcanzar tu máquina.

**1. Levantar el túnel** (dejar la terminal abierta):

```bash
cloudflared tunnel --url http://localhost:4000
```

Copiar la URL `https://algo.trycloudflare.com`.

**2. En el repositorio de GitHub** → *Settings → Webhooks → Add webhook*:

| Campo | Valor |
|---|---|
| Payload URL | `https://algo.trycloudflare.com/api/webhooks/github/<ID_AUTOMATIZACION>` |
| Content type | `application/json` |
| Secret | el `GITHUB_WEBHOOK_SECRET` del `.env` |
| Events | *Let me select* → **Issues** |

**3. Abrir un issue** en ese repositorio.

**4. Verificar en tres lugares:**

- **GitHub** → *Recent Deliveries*: la entrega con **202**
- **FlowHub** → *Historial*: la ejecución, y en su detalle el `triggerData` con
  los datos reales del issue
- **La acción**: el correo recibido o el issue creado, según la automatización

> La URL del túnel cambia al reiniciarlo. Hay que actualizarla en GitHub.

**Firma inválida:** cambiar el *Secret* en GitHub por otro valor y volver a abrir
un issue. La entrega debe dar **401**. Restaurarlo después.

---

## 6. Idempotencia

En *Recent Deliveries* de GitHub, elegir una entrega y pulsar **Redeliver** dos o
tres veces. GitHub reenvía **la misma entrega con el mismo identificador**.

En el Historial debe seguir habiendo **una sola ejecución**. En los registros del
worker, los reenvíos dicen *"ejecución ya registrada"*.

Sin túnel, el equivalente es encolar tres veces con el mismo identificador de evento:

```bash
npm run enqueue:test-job <ID> mismo-evento-1
```

---

## 7. Reintentos, retroceso y cola de fallidos

Se necesita una automatización que falle. La más simple: una acción de **Telegram**
con el `chatId` vacío, o con `TELEGRAM_BOT_TOKEN` sin configurar.

**Fallo transitorio (5xx): tres intentos espaciándose.**

```bash
npm run enqueue:test-job <ID_QUE_FALLA> <ID_EVENTO>
```

```bash
docker logs flowhub-worker --timestamps --since 1m
```

Las marcas de tiempo deben mostrar los intentos separados por **1 s, luego 2 s**
(retroceso exponencial), y al final *"agotó los reintentos, se envía a la DLQ"*.

**Fallo permanente (4xx): un solo intento.** Con un `chatId` vacío y el token
configurado, el error es `MISSING_CHAT_ID` (400) y el registro dice
*"error permanente, no se reintenta"*. Va directo a la cola de fallidos.

**La ejecución queda `FAILED`** en el Historial, con el código del error en el detalle.

---

## 8. Condiciones y plantillas

**Condiciones:** crear una automatización con una condición que no se cumpla
(campo `action`, operador `eq`, valor `jamas-coincide`). Al dispararla, la
ejecución queda **Omitida** y en su detalle la salida dice
`"reason": "conditions_not_met"`.

**Plantillas:** poner `{{trigger.title}}` en algún parámetro de la acción. Al
dispararla, el correo o el issue debe llegar con el valor real, no con las llaves.
En el detalle de la ejecución, la salida muestra los parámetros ya resueltos.

Un campo que no existe se reemplaza por vacío: es el comportamiento esperado.

---

## 9. Disparador por tiempo (cron)

Crear una automatización con disparador **CRON** y expresión `*/5 * * * *`.
Esperar unos 30 segundos y comprobar que quedó programada:

```bash
node -e "const{createExecutionsQueue}=require('./src/shared/queue');const q=createExecutionsQueue();q.getRepeatableJobs().then(j=>{console.log(j.map(x=>x.name+' | '+x.pattern));return q.close()}).then(()=>process.exit(0))"
```

Después **desactivarla** desde la web, esperar otros 30 segundos y repetir el
comando: la programación debe haber desaparecido.

---

## 10. Bitácora

En **Historial**: la tabla muestra estado, automatización, fecha, duración e intento.
Los chips filtran por estado y muestran el conteo.

*Ver detalle* abre la entrada del disparador, la salida de cada acción y el error
si lo hubo.

> `Pendiente` y `En curso` casi siempre están en 0: son estados que duran
> milisegundos, entre que se crea la ejecución y termina.

---

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| `501 NOT_IMPLEMENTED` | Responde un contenedor viejo; reconstruir con `--build` |
| `bind: Solo se permite un uso...` | Un proceso local ocupa el 4000 |
| El webhook da `401` | El *Secret* de GitHub no coincide con el `.env` |
| El webhook da `202` pero no hay ejecución | El identificador de la automatización es incorrecto |
| Acción de Gmail da `401` | El acceso caducó; reconectar la cuenta en *Conexiones* |
| Nada aparece en el Historial | Estás con otra cuenta, o el worker está detenido |
| Las plantillas salen vacías | Ese campo no existe en los datos del disparador |

> Tras cambiar código o el `.env`, los contenedores no se enteran solos:
> `docker compose --profile app up -d --build`
