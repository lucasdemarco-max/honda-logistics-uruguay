# Seguimiento de casos: importación desde Excel

## Archivo de referencia

- Nombre original: `WEB - Casos de Clientes.xlsx`
- Archivo aportado al proyecto por el usuario: `/mnt/data/WEB - Casos de Clientes.xlsx` (ubicación temporal del entorno de trabajo de ChatGPT, NO es una URL pública ni una ruta persistente de Lovable).
- Actualizaciones futuras: abrir **Administración → Actualizar seguimiento de casos desde Excel**, seleccionar el archivo Excel actualizado y confirmar la importación. El panel recordará el nombre de origen de cada lote, pero los bytes del Excel no se almacenan ni se incluyen en GitHub.
- Estructura verificada al 26-11-2026: **4.216** líneas, **1.436** casos diferentes; `Caso Min` tiene **5 dígitos**. El buscador exige **6** y agrega un cero a la izquierda al importar. Por ejemplo, `01043` → `001043`.
- La columna `Tipo de Vehiculo` contiene en muchos registros un identificador o matrícula; el modelo legible aparece en `Version`. La interfaz presenta el modelo de `Version` si está informado, y guarda también el valor literal de `Tipo de Vehiculo`.

## Mapeo de campos

| Interfaz | Columna Excel | Almacenamiento |
| --- | --- | --- |
| Número de búsqueda | Caso Min | case_min, 6 dígitos |
| Nro. de caso (CPED) | Nro de CPED | cped |
| Cliente asociado | Cliente | customer_name |
| Nro. de chasis | Chasis | chassis |
| Modelo del vehículo | Version (preferida), Tipo de Vehiculo (alternativa) | vehicle_version, vehicle_type |
| Asesor asignado | Responsable Solicitante | requester |
| Sucursal asignada | Area Solicitante | requester_area |
| Código de repuesto | SKU | lines[].sku |
| Descripción | Descripcion | lines[].description |
| Cantidad | Qty Solicitada | lines[].quantity |
| Estado del caso | Status del Documento | lines[].document_status |
| Línea del caso | Estado 01 | lines[].line_status |
| Estado logístico | Estado 02 | lines[].logistics_status |
| Documento relacionado | Factura Asociada | lines[].related_document |

El parser agrupa todas las líneas por `Caso Min` (y valida correspondencia `Nro de CPED`). Una importación posterior reemplaza el conjunto de líneas de cada caso afectado. Los casos no incluidos en la nueva carga se conservan; una baja requerirá un proceso administrativo separado.

## Seguridad y puesta en marcha

1. Aplicar en la base de datos vinculada la migración `supabase/migrations/20261126150000_customer_case_imports.sql`.
2. Iniciar sesión con cuenta de rol `admin`, abrir `/admin` y cargar el Excel. Sin esta importación, el buscador no tendrá esos casos.
3. Para consultas de clientes, validar la cuenta (`habilitada`), registrar el VIN y verificar que `vehicles.verified = true` y `vehicles.owner_id = auth.uid()`.
4. En `/seguimiento`, escribir el número de seis dígitos; el buscador respeta la seguridad de filas de Supabase. Los usuarios sin autorización no pueden acceder al nombre ni al chasis por conocer el número.
5. **No subir este Excel a GitHub ni a la carpeta `public`**, no convertirlo en JSON en el frontend y no dar acceso público a consultas por código.

El diseño y la importación se encuentran en la rama `feature/catalogo-modelid-categoryid-excel`. No se han ejecutado aquí las migraciones sobre una base conectada y el libro todavía no se ha cargado al servidor de producción.
