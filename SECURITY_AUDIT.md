# Auditoría de secretos del historial Git

Fecha de revisión: 17 de agosto de 2026.

## Método

Se agregó `npm run security:audit-history` para revisar todas las referencias devueltas por
`git rev-list --all`. El análisis busca firmas fuertes de credenciales y nombres de archivos
sensibles. Solo informa la regla y la ubicación; no imprime el contenido encontrado.

Esta comprobación reduce el riesgo, pero no sustituye un escáner especializado ni la revisión
de los proveedores. Antes de una entrega pública también se recomienda revisar las alertas de
secret scanning del alojamiento Git.

## Resultado actual

La auditoría revisó 93 commits y encontró una cookie de sesión serializada dentro del archivo
histórico `cookies.txt`, presente en siete commits. El archivo ya no pertenece al árbol actual,
pero eliminarlo en un commit posterior no lo elimina del historial.

Por este hallazgo, la tarea 69 permanece abierta. No se debe copiar el valor a documentación,
issues, mensajes ni capturas.

## Remediación requerida

1. Rotar `SESSION_SECRET` en todos los entornos compartidos y reiniciar API y sesiones. Esto
   invalida las cookies firmadas con la clave anterior.
2. Acordar una ventana con el equipo para reescribir todas las referencias afectadas mediante
   `git filter-repo` y hacer un push forzado protegido.
3. Pedir a cada integrante que vuelva a clonar o resincronice según el procedimiento acordado;
   de lo contrario puede reintroducir el historial anterior.
4. Volver a ejecutar `npm run security:audit-history` y marcar la tarea 69 únicamente cuando
   termine sin hallazgos.

La reescritura no se realiza automáticamente porque cambia los identificadores de los commits
y afecta a todos los clones y ramas del equipo.
