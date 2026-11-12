# Portal SSO

Portal interno de demostración para el TFM. El navegador solo presenta las vistas. Express mantiene la sesión, valida los tokens de Keycloak y aplica los permisos. Hay dos perfiles ficticios: `user` y `admin`.

La alta disponibilidad no forma parte de este entorno. En la memoria queda como análisis.

## Arranque

Hace falta Docker y Node.js 20 o superior.

```bash
cp .env.example .env
docker compose up
npm install
npm start
```

Keycloak queda en `http://localhost:8080` y el portal en `http://localhost:3000`. La consola de administración usa `admin` / `admin` (`http://localhost:8080`). Esos datos, el secreto del cliente y las contraseñas de los usuarios de prueba solo sirven para desarrollo.

| Usuario | Contraseña | Perfil |
| --- | --- | --- |
| `usuario` | `usuario` | `user`: avisos del equipo |
| `admin` | `admin` | `admin`: avisos y directorio |

El secreto `dev-only-portal-secret` está en `.env` porque lo usa el backend, y también en `keycloak/realm-sso-portal.json` porque Keycloak importa el realm desde ese fichero. Si se cambia uno, hay que cambiar el otro.

La aplicación se ejecuta en el host, no dentro de Compose. Así el navegador y Express usan el mismo emisor: `http://localhost:8080/realms/sso-portal`.

## Qué comprobar

- Sin sesión, `/app` redirige a `/login` y desde ahí a Keycloak. `/api/avisos` responde 401.
- `usuario` ve los avisos. `/api/admin/usuarios` y `/admin` responden 403 aunque se ocultara la sección en la página.
- `admin` ve los avisos y el directorio.
- Cerrar sesión termina la sesión del portal y la de Keycloak.
- Con Keycloak parado (`docker compose stop`), Identificarse muestra el aviso de proveedor no disponible y no se crea sesión.

```bash
npm test
```

Las pruebas no levantan Keycloak. Cubren el acceso sin sesión, los dos perfiles, el cierre de sesión, un `state` que no coincide y un access token inválido, de otro cliente o caducado.

## HTTP y TLS

Este entorno usa HTTP en localhost. Por eso la cookie de sesión es `HttpOnly` y `SameSite=Lax`, pero no `Secure`: el navegador rechazaría una cookie `Secure` en `http://localhost`. Keycloak arranca con `start-dev`, que también publica HTTP.

En un despliegue con HTTPS habría que poner `COOKIE_SECURE=true`, publicar el portal y Keycloak con certificados y hacer coincidir el emisor con ese nombre. Este repositorio no demuestra esa configuración.

## Flujo

1. `/login` guarda `state`, `nonce` y el verificador PKCE en la sesión y redirige a Keycloak.
2. `/callback` comprueba el `state`, canjea el código con el secreto del cliente y el verificador, y valida el ID token y la firma del access token.
3. La cookie guarda la identidad y los roles. El ID token se conserva solo en el servidor para el cierre de sesión. El navegador no recibe los tokens.
4. Cada operación protegida vuelve a comprobar la sesión y el rol en Express.
