# Honda Logistics Uruguay

Construí una aplicación web full-stack llamada “Honda Logistics” para una empresa de Uruguay dedicada a repuestos Honda Automóviles. Este es el inicio de un sistema real, no una landing page estática. Idioma español (Uruguay), moneda UYU, diseño responsive para móvil/tablet/escritorio. Identidad visual profesional automotriz en rojo, blanco, negro y grises. No uses la mascota LOGI ni imágenes de liquidación. Dominio previsto: hondalogistics.com.uy (todavía no conectado).

OBJETIVO DE ESTA PRIMERA ETAPA: crear una base sólida y navegable con página pública, estructura de catálogo, autenticación y panel administrativo. Prioriza arquitectura mantenible, accesibilidad, estados vacíos realistas y datos de demostración claramente identificados como ejemplos, sin inventar stock o precios reales.

PÁGINAS PÚBLICAS:
- Inicio con encabezado Honda Logistics, navegación, buscador prominente, accesos al catálogo, seguimiento, presupuestos y Marcas Asociadas.
- Catálogo de repuestos con categorías: Filtros, Correas, Frenos, Encendido, Suspensión, Motor y otras. Búsqueda por nombre/código/modelo y filtros por categoría, modelo y año. Tarjetas de producto con imagen, nombre, código Honda cuando exista, descripción, compatibilidad, precio UYU y disponibilidad/stock. No afirmar compatibilidad universal: cada aplicación debe cargarse explícitamente.
- Modelos previstos: Civic, Fit, City, HR-V, CR-V, Accord, WR-V, Pilot, Otros modelos.
- Carrito: agregar varios productos, modificar cantidades, quitar artículos y calcular total. Checkout informativo: pagos online por transferencia bancaria únicamente; tarjetas de crédito/débito solo en el local físico. No integrar pagos con tarjeta online.
- Envíos dentro de Uruguay y retiro a coordinar; no prometer transportistas específicos.
- Sección “Marcas Asociadas” para neumáticos, baterías, lubricantes, accesorios y otros productos. Admin podrá gestionar marcas, logos, imágenes, productos, compatibilidades, precios, stock, promociones y contacto. Diferenciar claramente “homologado por Honda” de “compatible/recomendado”; no declarar homologación sin respaldo documental.
- Acceso a registro/inicio de sesión y páginas informativas de seguimiento de casos y presupuestos por número de chasis.

ÁREA PRIVADA / ADMINISTRACIÓN:
- Roles: administrador, operador autorizado y cliente. Restringir por rol y propiedad los datos privados.
- Registro de clientes: nombre, documento, email, teléfono y uno o varios vehículos (VIN/chasis, patente, modelo y año). Cuenta inicialmente pendiente; Honda Logistics valida manualmente antes de habilitar acceso. Estados: Pendiente de validación, En revisión, Cuenta habilitada, Datos incorrectos/Rechazada, Corrección solicitada. Incluir flujo de aprobación/rechazo/solicitud de información en panel admin. VIN y patente no son por sí solos autenticación suficiente.
- Seguimiento de casos: un caso contiene varios repuestos, cada uno con seguimiento y estado independiente, fechas y observaciones. Estados exactos: “Pendiente con Fabrica”, “En Transito de Entrega”, “Liberacion de Aduanas”, “En recepcion”, “Arribado”, “Despachado”, “Entregado”. Mostrar historial de cambios; el admin puede corregir estados y cada modificación debe quedar auditada.
- Presupuestos por VIN/chasis: operadores autorizados cargan presupuestos con chasis, vehículo, número de presupuesto, fecha, repuestos, códigos, descripciones, cantidades, precio unitario/total y observaciones. Cliente autorizado consulta presupuestos en su perfil y estado de compra. Estados: Pendiente de decisión, Comprado parcialmente, Comprado, Vencido, Anulado. Posibilidad de estado por ítem.
- Cambio de titularidad: nuevo dueño inicia sesión/registro y solicita asociar VIN existente, patente y documentación que acredite transferencia. Flujo de revisión administrativa: Pendiente de revisión, En verificación, Documentación adicional solicitada, Aprobada, Rechazada. Al aprobar, reasociar vehículo al nuevo perfil y retirar al antiguo dueño el acceso privado; conservar auditoría interna sin exponer información privada anterior.
- Panel admin para productos, categorías, compatibilidades, stock, marcas asociadas, clientes, vehículos, solicitudes de alta, presupuestos, casos, estados logísticos, solicitudes de cambio de titularidad y auditoría.

SEGURIDAD Y CALIDAD:
- Usa backend/base de datos persistente y autenticación segura disponibles en el stack Lovable. Nunca guardes contraseñas en texto plano. Implementa autorización del lado servidor/base de datos, no solo ocultando elementos de interfaz. Aplica políticas de acceso para que cada cliente solo vea sus propios vehículos, casos y presupuestos. Operadores solo con permisos asignados. Registra auditoría de acciones administrativas y cambios de titularidad. No publiques datos personales ni VIN completos en vistas públicas.
- Crea esquema de datos coherente y migraciones/relaciones necesarias. Si alguna integración/credencial externa no está configurada, deja la funcionalidad preparada y documenta claramente lo pendiente; no inventes credenciales ni confirmes operaciones externas.
- Construye primero una versión funcional y visualmente pulida de la estructura principal, con navegación y pantallas clave; identifica explícitamente cualquier función aún simulada o pendiente de backend.
- No publicar el sitio automáticamente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/053492f1-cea1-4157-8609-7f588e6cb249).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Catálogo por modelo e importación universal

La evolución del catálogo usa ModelID → CategoryID, categorías dinámicas, filtros por año y búsqueda secundaria por código. La importación administrativa acepta Excel/CSV de cualquier categoría, ofrece vista previa y conserva los datos no informados y las compatibilidades existentes.

La especificación de identificadores, reglas de conservación, configuración de Supabase, validaciones y límites de operación se encuentra en [docs/catalogo-importacion.md](docs/catalogo-importacion.md). El sincronizador local opcional se documenta en [scripts/README.md](scripts/README.md).
