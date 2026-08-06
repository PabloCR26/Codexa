# Auditoría de integración — 2026-08-06

## Alcance

Se auditó la integración de los commits `8143706` a `5aca9ce` incorporados directamente
en `origin/main`, además de los commits locales de la tarea 9. El objetivo fue conservar
el trabajo válido de API, worker y frontend, resolver conflictos y comprobar la solución
completa.

## Historia y colaboración

- Los PR #1 y #2 corresponden a la base inicial y a la corrección de instalación.
- Las tareas 10 y 13–20 se enviaron directamente a `main`, sin pull requests ni checks de CI.
- Eliam aportó la integración del monorepo y las tareas 10 y 13–18.
- Pablo aportó las tareas 19 y 20.
- El merge local tenía conflictos en `TAREAS.md` y `src/api/index.js`.

Para los siguientes cambios se recomienda una rama por tarea, un pull request y una revisión
antes de fusionar. No hacer `git pull` con cambios locales o commits sin publicar: primero
usar `git status`, confirmar el trabajo y actualizar la rama desde `origin/main`.

## Verificaciones completadas

- Instalación reproducible con `npm ci` en raíz y `web/`.
- Esquema Prisma válido y migraciones sin pendientes.
- Auditoría npm del backend sin vulnerabilidades.
- Sintaxis válida en todos los archivos JavaScript del backend.
- Build de producción y lint del frontend exitosos.
- Registro, sesión, login y logout probados de punta a punta.
- Aislamiento probado con dos usuarios: un usuario no puede leer automatizaciones del otro.
- Rate limiting probado: el login correcto reinicia el contador, los primeros cinco fallos
  responden `401` y el sexto responde `429` con `Retry-After`.
- Sesión conservada después de reiniciar la API mediante almacenamiento en Redis.
- Worker conectado a la cola `executions`.
- Perfil Docker `app` construido y levantado con PostgreSQL, Redis, API, worker y frontend.
- Frontend y `/api/health` accesibles a través de nginx en `http://localhost:8080`.

## Correcciones aplicadas durante el merge

- Se combinaron los routers explícitos de la tarea 9 con auth, automations y CSRF.
- Se retiró `cookies.txt` del árbol y se agregó a `.gitignore`.
- El rate limiter ahora cuenta únicamente credenciales inválidas y separa los contadores
  por IP y correo normalizado, sin guardar el correo en Redis.
- Se agregó `Retry-After` a las respuestas `429`.
- Las sesiones dejaron de usar MemoryStore y ahora se persisten en Redis.
- La comparación del token CSRF usa una comparación de tiempo constante.
- Se corrigió en el README el comando para detener solo API, worker y frontend.
- `TAREAS.md` conserva sin marcar las tareas 1 y 2 porque no fueron verificadas.

## Riesgos pendientes

1. `cookies.txt` permanece en la historia de los commits remotos donde fue agregado. No se
   leyó su contenido durante esta auditoría. Eliminarlo de la historia requiere reescribir
   commits y coordinar un nuevo clonado con todo el equipo. Las sesiones antiguas quedaron
   invalidadas al reiniciar el almacenamiento anterior.
2. `npm audit` del frontend reporta dos alertas altas de React Router asociadas al modo RSC.
   FlowHub usa una SPA cliente y no habilita RSC; npm no ofrece una corrección compatible en
   este momento. Se debe revisar nuevamente antes de producción.
3. No existe una suite automatizada ni checks de GitHub Actions. Las verificaciones actuales
   son manuales y deben repetirse después de cada integración.
4. El repositorio remoto es público en GitHub; la tarea 2 exige un repositorio privado en
   GitLab. Debe definirse con el docente cuál plataforma y visibilidad son obligatorias.
