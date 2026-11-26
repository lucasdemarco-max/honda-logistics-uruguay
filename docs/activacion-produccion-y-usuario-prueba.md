# Activación productiva y cuenta de prueba — Honda Logistics

## Proyecto

- Supabase project ID de `supabase/config.toml`: `bshbpgenlzduwibqaegw`.
- Rama de desarrollo: `feature/catalogo-modelid-categoryid-excel`.
- Esta guía no ejecuta acciones de producción ni contiene credenciales.
- No subir `WEB - Casos de Clientes.xlsx` a la carpeta pública ni al repositorio.

## 1. Migración

Con acceso de administrador al proyecto correcto en Supabase, verificar que el entorno es el previsto y aplicar:

`supabase/migrations/20261126150000_customer_case_imports.sql`

La tabla `customer_case_imports` exige `case_min` de **cinco dígitos**. El script implementa RLS; solo operadores autorizados o clientes con cuenta habilitada y vehículo verificado pueden leer los casos correspondientes. La función de importación valida que la sesión sea de rol **admin**.

Verificar tras la migración que existen las funciones `lookup_customer_case` e `import_customer_case_snapshots` y que la consulta anónima no puede leer datos.

## 2. Cargar casos

Ingresar con una cuenta administradora en `/admin`.
En «Actualizar seguimiento de casos desde Excel», cargar el libro original `WEB - Casos de Clientes.xlsx`, verificar el resumen y confirmar. Los números deben conservar los cinco dígitos; ejemplo: `01043`.

El Excel del 26/11/2026 tiene 1.436 casos y 4.216 líneas según el análisis anterior, pero las cargas futuras pueden tener distinto tamaño.

## 3. Cuenta de prueba

No compartir contraseñas de prueba ni insertar una clave en el código o en GitHub.

En Supabase Dashboard → Authentication → Users, usar «Invite user» con un correo de pruebas controlado por la empresa. El destinatario crea una contraseña personal desde el enlace de invitación. Alternativamente, registrarlo desde `/auth?modo=registro` y confirmar su correo.

Para probar las consultas reales:
- Confirmar que la cuenta tiene perfil `habilitada`.
- Verificar que el vehículo de prueba exista en `vehicles` con `owner_id` correspondiente al usuario de pruebas y `verified=true`.
- Para evitar divulgación de datos reales, usar un chasis y un caso **sintéticos** en un entorno de ensayo. No vincular un VIN real a una cuenta que no es de su propietario.
- Comprobar con una cuenta sin acceso que `/seguimiento` no devuelve datos de terceros, incluso conociendo el número de caso.

## 4. Verificaciones previas a publicar

- `npm install` y `npm test` / `npm run build`, desde un entorno con Node instalado.
- Inicio: botones «Elegir modelo Honda» e «Iniciar sesión».
- Registro, ingreso, salida, recuperación de contraseña, validación.
- Importación de casos, búsqueda por cinco dígitos, múltiples SKU por caso, acceso permitido y denegado.
- No publicar el libro original como recurso descargable.
- Confirmar una vista previa y su versión antes de publicar en el dominio final.

El código está guardado, pero **se requiere una conexión administrativa a Supabase y al entorno de despliegue** para aplicar la migración, invitar al usuario y publicar el sitio.
