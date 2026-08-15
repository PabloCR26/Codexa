# Prueba del bot de Telegram

Este documento resume cómo probar la acción de Telegram de punta a punta en FlowHub.

## Requisitos previos

- Tener levantados PostgreSQL y Redis con `docker compose up -d --wait`.
- Tener la API y el worker corriendo.
- Haber creado el bot con `@BotFather` y copiado el token en `TELEGRAM_BOT_TOKEN` dentro de `.env`.
- Conocer el `chatId` del chat o grupo donde se van a recibir los mensajes.

## 1. Verificar el entorno

1. Confirmar que la API responde:

```bash
curl http://localhost:4000/api/health
```

2. Confirmar que el worker está corriendo y conectado a Redis.

3. Abrir la aplicación web en `http://localhost:5173` e iniciar sesión.

## 2. Crear una automatización de prueba

1. Ir a **Automatizaciones** y crear una nueva.
2. Elegir un disparador simple, por ejemplo **Webhook de GitHub**.
3. Configurar la acción:
   - Proveedor: **Telegram**
   - Tipo: **Enviar mensaje**
   - Chat ID: el valor real del chat o grupo
   - Mensaje: `Prueba Telegram: {{trigger.title}}`
4. Guardar la automatización y dejarla **activa**.

## 3. Disparar la automatización

Puedes usar cualquiera de estas opciones:

### Opción A: desde GitHub

1. Entrar al repositorio de prueba en GitHub.
2. Ir a **Settings → Webhooks → Add webhook**.
3. En **Payload URL** colocar la URL pública de FlowHub con la ruta de la automatización.
4. En **Content type** elegir `application/json`.
5. En **Secret** colocar el valor de `GITHUB_WEBHOOK_SECRET` del archivo `.env`.
6. En **Which events?** seleccionar **Issues**.
7. Guardar el webhook.
8. Abrir un issue nuevo en ese repo.
9. Esperar a que el worker procese el job.

### Opción B: sin internet, desde el script de cola

1. Abrir la automatización en la web.
2. Mirar la barra de direcciones: el ID aparece al final de la URL, por ejemplo en `/automations/cmXXXXXXXX`.
3. Copiar ese valor.
4. Encolar un evento de prueba:

```bash
npm run enqueue:test-job <ID_AUTOMATIZACION>
```

5. Revisar los logs del worker.

## 4. Resultado esperado

- El worker debe registrar que procesó el job.
- Telegram debe recibir un mensaje con el texto configurado.
- En **Historial** la ejecución debe quedar como exitosa.

## 5. Prueba de error controlado

Si se quiere verificar el manejo de fallos:

1. Editar la automatización.
2. Dejar el campo **Chat ID** vacío.
3. Guardar y volver a dispararla.

Resultado esperado:

- Si `TELEGRAM_BOT_TOKEN` está configurado, el error debe ser permanente y la ejecución debe ir a fallida.
- Si `TELEGRAM_BOT_TOKEN` está vacío, el worker debe reintentar el job y luego enviarlo a la DLQ.

## 6. Notas útiles

- Telegram no usa OAuth ni aparece en **Conexiones**.
- El adaptador acepta `text` como campo principal y `message` como alias por compatibilidad.
- Si el mensaje usa plantillas, los campos disponibles dependen del disparador que se use.