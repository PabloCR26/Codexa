# Tutorial de credenciales OAuth para FlowHub

Esta guía explica cómo configurar las credenciales OAuth de GitHub y Google para ejecutar
FlowHub localmente.

## Antes de comenzar

- La aplicación local debe abrirse en `http://localhost:8080`.
- La API debe estar disponible en `http://localhost:4000`.
- Copia `.env.example` como `.env` si todavía no existe.
- `.env` contiene secretos y **nunca debe subirse a Git**.
- No compartas Client Secrets en issues, capturas de pantalla ni mensajes públicos.

El equipo puede usar un único cliente OAuth compartiendo sus credenciales por un medio seguro,
o cada integrante puede crear clientes propios para su ambiente local. Si cada persona crea los
suyos, debe repetir esta guía y guardar sus valores únicamente en su `.env`.

## GitHub OAuth

### 1. Crear la OAuth App

1. Inicia sesión en GitHub.
2. Abre **Settings** desde el menú de tu perfil.
3. Entra en **Developer settings**.
4. Selecciona **OAuth Apps**.
5. Pulsa **New OAuth App**.

### 2. Completar la configuración

Usa estos valores:

| Campo | Valor |
|---|---|
| Application name | `FlowHub Local - Tu Nombre` |
| Homepage URL | `http://localhost:8080` |
| Application description | Opcional |
| Authorization callback URL | `http://localhost:4000/api/oauth/github/callback` |

La URL de callback debe coincidir exactamente: no uses `127.0.0.1`, no cambies el puerto y no
agregues una barra al final.

Pulsa **Register application**.

### 3. Obtener las credenciales

1. Copia el **Client ID**.
2. Pulsa **Generate a new client secret**.
3. Copia el secret inmediatamente y guárdalo en `.env`.

```env
GITHUB_CLIENT_ID=tu_client_id
GITHUB_CLIENT_SECRET=tu_client_secret
GITHUB_REDIRECT_URI=http://localhost:4000/api/oauth/github/callback
GITHUB_OAUTH_SCOPES=public_repo
```

`public_repo` permite trabajar con issues de repositorios públicos. Usa `repo` únicamente si
la demostración necesita repositorios privados, porque concede permisos más amplios.

Consulta también la [documentación oficial del flujo OAuth de GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## Google OAuth y Gmail API

La aplicación se configura en Google Cloud Console usando una cuenta normal de Google. Crear
el proyecto, las credenciales OAuth y usar Gmail API dentro de sus cuotas normales para esta
demostración no requiere contratar servidores de Google Cloud.

### 1. Crear o seleccionar un proyecto

1. Abre [Google Cloud Console](https://console.cloud.google.com/).
2. Selecciona un proyecto existente o crea uno, por ejemplo `FlowHub Universidad`.
3. Comprueba que ese proyecto permanezca seleccionado durante todos los pasos.

### 2. Habilitar Gmail API

1. Abre **APIs & Services → Library**.
2. Busca **Gmail API**.
3. Abre el resultado y pulsa **Enable**.

### 3. Configurar la marca de la aplicación

Abre **Google Auth Platform → Branding** y completa:

- App name: `FlowHub`.
- User support email: tu correo.
- App logo: opcional.
- Authorized domains: vacío para el ambiente local.
- Developer contact information: tu correo.

Guarda los cambios.

### 4. Configurar la audiencia de prueba

Abre **Google Auth Platform → Audience** y selecciona:

- User type: **External**.
- Publishing status: **Testing**.

En **Test users**, agrega el correo de Google que usarás para conectar Gmail y los correos de
los compañeros que probarán este mismo cliente OAuth.

En modo Testing puede aparecer una advertencia de aplicación no verificada. Además, las
autorizaciones que solicitan scopes de Gmail y sus refresh tokens expiran después de siete
días, por lo que puede ser necesario conectar la cuenta nuevamente.

Consulta la [documentación oficial de audiencia y usuarios de prueba](https://support.google.com/cloud/answer/15549945).

### 5. Agregar el scope de Gmail

1. Abre **Google Auth Platform → Data Access**.
2. Pulsa **Add or remove scopes**.
3. Busca y selecciona:

```text
https://www.googleapis.com/auth/gmail.modify
```

4. Guarda los cambios.

Este scope permite leer, organizar, redactar y enviar correos. Google lo clasifica como
restringido, pero el equipo puede usarlo durante el desarrollo con la aplicación en Testing y
las cuentas agregadas como usuarios de prueba. Consulta los [scopes oficiales de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).

### 6. Crear el cliente OAuth

1. Abre **Google Auth Platform → Clients**.
2. Pulsa **Create client**.
3. Selecciona **Web application**.
4. Usa un nombre como `FlowHub Local - Tu Nombre`.
5. En **Authorized JavaScript origins**, agrega:

```text
http://localhost:8080
```

6. En **Authorized redirect URIs**, agrega exactamente:

```text
http://localhost:4000/api/oauth/google/callback
```

7. Pulsa **Create**.

El Client Secret puede mostrarse solamente durante la creación. Guárdalo inmediatamente en
`.env`. Consulta la [documentación oficial de clientes OAuth](https://support.google.com/cloud/answer/15549257).

```env
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/oauth/google/callback
```

Para el perfil Docker, confirma también:

```env
DOCKER_WEB_URL=http://localhost:8080
```

## Aplicar y probar la configuración

Después de modificar `.env`, reconstruye el perfil de la aplicación:

```bash
docker compose --profile app up -d --build --wait
docker compose --profile app ps
```

Luego:

1. Abre `http://localhost:8080`.
2. Regístrate o inicia sesión.
3. Entra en **Conexiones**.
4. Pulsa **Conectar GitHub** y autoriza la aplicación.
5. Pulsa **Conectar Google** y usa una cuenta incluida entre los usuarios de prueba.

## Verificar el cifrado de los tokens

Abre Prisma Studio:

```bash
npm run prisma:studio
```

En el modelo `Connection`, los campos `accessTokenEncrypted` y
`refreshTokenEncrypted` deben contener valores que comiencen con `v1:`. Nunca deben mostrar el
token original legible.

También puede verificarse sin mostrar los valores almacenados:

```bash
npm run oauth:verify-storage
```

No copies esos valores en capturas, documentación o conversaciones, aunque estén cifrados.

## Problemas frecuentes

- `redirect_uri_mismatch`: compara el callback configurado en el proveedor con el de `.env`;
  deben ser idénticos.
- `access_denied` en Google: confirma que la cuenta esté en **Audience → Test users**.
- Google no entrega refresh token: revoca la autorización anterior y conecta nuevamente; la
  aplicación solicita `access_type=offline` y consentimiento explícito.
- Error OAuth después de cambiar `.env`: reconstruye/recrea el contenedor de la API.
- Error CSRF en local: abre la web con `http://localhost:8080` y confirma que `WEB_URL` tenga
  exactamente ese origen.
