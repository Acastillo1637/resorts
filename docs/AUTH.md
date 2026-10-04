# Autenticación y correos

No se necesita migración. La aplicación conserva Supabase Auth, RLS y la verificación de identidad. Nombre/teléfono y contraseña se actualizan desde Mi cuenta sin enlaces de recuperación.

## Dashboard

1. **Authentication → Sign In / Providers → Email → Confirm email: OFF** (en versiones anteriores: Authentication → Providers → Email). Guardar. El registro devuelve una sesión y permite acceso inmediato. El frontend no puede desactivar esta opción; mientras esté activa informa que el registro inmediato no está habilitado.
2. El cambio de correo de usuarios existentes siempre verifica la dirección nueva con el API público de Supabase Auth. **Secure email change: OFF** reduce el flujo a una confirmación en el nuevo correo; ON confirma en ambos. Esta opción no permite eliminar toda confirmación. No usar el API administrativo ni exponer secretos para saltarla. La página muestra instrucciones solamente si Supabase devuelve un cambio pendiente.
3. **Authentication → URL Configuration → Site URL**: origen real principal de Almond Resorts, con protocolo y puerto si corresponde. En producción usar el dominio HTTPS disponible. Eliminar el localhost/puerto antiguo como destino principal. En desarrollo usar la dirección accesible desde el equipo donde se abrirá el correo. Localhost solo funciona desde el mismo equipo y con Vite encendido.
4. **Redirect URLs**: agregar estas tres rutas por cada origen utilizado: `ORIGEN/nueva-clave`, `ORIGEN/mi-cuenta`, `ORIGEN/mis-reservas`. ORIGEN es exactamente `window.location.origin` mostrado al abrir Almond Resorts, incluyendo puerto. Para red local utilizar el origen de la IP real del equipo servidor, no localhost; iniciar Vite con `npm run dev -- --host 0.0.0.0` y usar el puerto que indique. Agregar las mismas tres rutas bajo el dominio HTTPS de producción cuando exista. Usar rutas exactas y evitar comodines generales.
5. **Authentication → Email Templates → Reset Password**: el enlace debe usar `{{ .ConfirmationURL }}` (por ejemplo `<a href="{{ .ConfirmationURL }}">Restablecer contraseña</a>`). No usar una URL fija ni `{{ .SiteURL }}` como enlace de recuperación. Lo mismo aplica al enlace de Change Email. El servicio verifica el token y redirige al origen solicitado y autorizado.
6. Configurar **Authentication → SMTP Settings** con un proveedor válido para enviar a destinatarios reales; el servicio de envío predeterminado restringe los destinatarios y tiene límites. Las notificaciones de seguridad por cambio de contraseña/correo, si están habilitadas en Email Templates, son avisos y no bloquean estas operaciones.

## Verificación con cuenta propia

Después de guardar la configuración: registrar una cuenta y comprobar sesión inmediata; editar nombre/teléfono y contraseña en Mi cuenta; cerrar sesión e iniciar con la nueva contraseña. Desde Acceso → Olvidé mi contraseña, solicitar un enlace nuevo, abrirlo desde un equipo que alcance el origen utilizado, comprobar `/nueva-clave`, guardar una clave distinta y volver a iniciar sesión. Repetir desde el origen de red y, al desplegar, desde producción. Los enlaces anteriores no se reescriben: solicitar otro tras corregir la configuración.

El cliente usa explícitamente el flujo implicit de Supabase para que el enlace de recuperación pueda abrirse en otro navegador/dispositivo sin depender de un verificador PKCE local. La autorización de recuperación requiere el evento validado PASSWORD_RECOVERY y se revalida con getUser antes de cambiar la clave; navegar manualmente a `/nueva-clave` no basta. Un enlace inválido/vencido permite solicitar otro.

Sin acceso al Dashboard y a un buzón de prueba no se puede verificar el envío real ni confirmar su allowlist, Site URL o plantilla; los tests locales no sustituyen esta comprobación.

Fuentes: https://supabase.com/docs/guides/auth/redirect-urls, https://supabase.com/docs/guides/auth/passwords, https://github.com/supabase/auth/blob/master/internal/api/user.go
