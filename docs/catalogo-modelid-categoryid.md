# Catálogo por modelo, categoría e importación universal

## Alcance y conservación

La navegación pública sigue Modelo → Categoría → Repuestos. El año es un filtro complementario y la búsqueda por código Honda, SKU o nombre conserva la selección. Las categorías y los modelos se obtienen de productos con aplicaciones cargadas; no existe una lista cerrada de sistemas o modelos. Los productos sin aplicación explícita siguen accesibles en el catálogo general, sin presentarse como compatibles con todos los vehículos.

El catálogo combina los productos de la base de datos con `src/data/filtros.json`. Se conservan los 52 SKU y las 132 aplicaciones del archivo original. Cuando existe el mismo SKU en ambas fuentes, la base de datos aporta su identidad y campos comerciales; las aplicaciones explícitas de las dos fuentes se conservan y deduplican. Los ejemplos siguen identificados mediante `is_demo`.

No se modifica el esquema, las migraciones, los archivos generados por Lovable ni las credenciales. No hay escrituras de datos reales al construir o probar el proyecto.

## Identidad y enlaces

| Dato                            | Uso                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `ModelID` en Excel              | UUID existente de `vehicle_models.id` o código estable exacto del modelo (`slug`).  |
| `CategoryID` en Excel           | UUID existente de `categories.id` o código estable exacto de la categoría (`slug`). |
| `ModelName` / `CategoryName`    | Nombres visibles; no sustituyen silenciosamente un ID contradictorio.               |
| `modelId` / `categoryId` en URL | Selección canónica del catálogo por identificador.                                  |
| `ModelID` / `CategoryID` en URL | Alias admitidos para enlaces existentes con mayúsculas.                             |
| `modelo` / `categoria` en URL   | Enlaces históricos por slug o nombre; se conservan.                                 |

Los IDs reales tienen prioridad sobre los códigos. Los UUID desconocidos se rechazan para evitar crear referencias equivocadas. Un código nuevo se guarda en `slug`, y PostgreSQL asigna su UUID interno. No se introduce una columna nueva de IDs externos ni se equiparan códigos diferentes por similitud de nombre.

Los IDs históricos del catálogo local continúan como alias cuando se encuentra el mismo slug en la base de datos. El acceso histórico `categoria=filtros` incluye también productos importados en las categorías correspondientes; ya no omite la base de datos.

Las facetas de categoría y los conteos se calculan sobre cada producto distinto. Modelo y año deben coincidir en la misma aplicación. El listado muestra 24 tarjetas inicialmente y permite cargar otras 24, manteniendo el total real.

## Contrato del Excel

La plantilla se descarga desde Administración. Incluye Productos, Instrucciones, Categorias y Modelos, con los UUID y códigos disponibles. Se admiten `.xlsx`, `.xls` y `.csv`, encabezados equivalentes en español e inglés, varias hojas de productos y títulos antes del encabezado.

| Columna canónica              | Regla                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKU`                         | Obligatoria. Identifica el producto; repetirla agrega aplicaciones al mismo producto.                                                                            |
| `Name`                        | Obligatoria. Nombre del repuesto.                                                                                                                                |
| `CategoryID` / `CategoryName` | La categoría se declara explícitamente. Una categoría nueva con código requiere nombre. También se conservan los encabezados históricos de categoría por nombre. |
| `HondaCode`                   | Código Honda opcional.                                                                                                                                           |
| `Description`                 | Descripción opcional.                                                                                                                                            |
| `Price`                       | Precio en UYU, no negativo, hasta dos decimales.                                                                                                                 |
| `Stock`                       | Entero no negativo. No se suma entre filas repetidas.                                                                                                            |
| `Availability`                | `en_stock`, `pocas_unidades`, `a_pedido`, `sin_stock` o `consultar`; acepta equivalentes documentados en español.                                                |
| `Active`                      | Sí/no, true/false o 1/0.                                                                                                                                         |
| `ModelID` / `ModelName`       | Aplicación explícita. Nuevos modelos se presentan para revisión antes de guardarlos.                                                                             |
| `YearFrom` / `YearTo`         | Obligatorios cuando hay modelo; enteros entre 1970 y 2100 y rango ordenado.                                                                                      |
| `CompatibilityNotes`          | Notas de la aplicación; requieren modelo.                                                                                                                        |

Las celdas opcionales vacías significan conservar el dato guardado. Para productos nuevos, quedan sin dato o con el valor predeterminado del esquema. `0` y `false` sí son cambios explícitos. Para borrar un dato existente se necesita una operación administrativa específica; una celda vacía no lo borra.

Si un SKU tiene varios precios en el archivo, se conserva la política existente de usar el mayor, con una advertencia visible antes de confirmar. Se rechazan nombres, categorías, existencias, estados o notas de una misma aplicación que se contradigan. Los distintos modelos y rangos del mismo SKU se combinan.

La categoría nunca se deduce del nombre del producto. La importación no inventa aplicaciones, años, stock, precios, homologaciones ni marcas.

### Lectura y validación

- Máximo 20 MB por archivo, 20.000 filas de productos en total, 100 hojas y 100 columnas por hoja.
- El encabezado se busca en las primeras 50 filas de cada hoja.
- Se pueden elegir las hojas que se importarán. La vista previa muestra la hoja y fila originales, y permite descargar los errores.
- Las hojas auxiliares se informan como omitidas; una hoja identificada como productos con encabezados inválidos produce un error explícito.
- Los SKU y códigos se conservan como texto. Una máscara inequívoca de ceros iniciales se respeta; separadores de miles, moneda o notación científica no alteran el identificador.
- Conviene guardar códigos largos o con ceros iniciales como Texto en Excel. Los números que ya perdieron precisión en el archivo no pueden reconstruirse.
- No se calculan fórmulas. Se requiere su valor calculado y guardado en Excel; las fórmulas sin caché y los errores de celda bloquean la lectura.

## Confirmación, permisos y reintentos

Leer el archivo y mostrar la vista previa no escribe en la base de datos. Las categorías y modelos faltantes se muestran como propuestas; solo se crean después de pulsar Confirmar importación.

Antes de guardar se verifican sesión, permiso `catalogo`, referencias actuales, productos y aplicaciones existentes. Se usa el cliente autenticado normal y permanecen las políticas RLS y auditorías del esquema existente. No se utiliza una clave de servicio.

Los productos existentes se actualizan por su ID y únicamente con los campos indicados. No hay `DELETE` ni reemplazo completo de las compatibilidades: se agregan las aplicaciones faltantes. Los IDs deterministas de las nuevas aplicaciones y la clave primaria existente protegen los reintentos idénticos. Las notas anteriores se conservan; una nota nueva distinta se agrega como información adicional de esa aplicación.

El guardado se realiza mediante varias solicitudes HTTP, no mediante una transacción única. Si una solicitud falla, se informa cuántas categorías, modelos, productos y aplicaciones se confirmaron. No se borran cambios anteriores como supuesto rollback. Se puede revisar el resultado y reintentar el mismo archivo. Un corte de conexión puede impedir confirmar una respuesta aunque el servidor haya guardado; en ese caso se debe recargar y volver a revisar.

### Desactivación de referencias incluidas en el archivo local

La lectura pública bajo RLS no puede consultar un producto inactivo de la base de datos para usarlo como señal de supresión del catálogo local. Por eso, el importador bloquea `Active=no` para los 52 SKU incluidos en el respaldo verificado: se debe actualizar también ese origen mediante el flujo de mantenimiento de Lovable. Los productos que existen únicamente en la base de datos sí admiten desactivación normal. Esta protección evita que una referencia reaparezca por el respaldo local.

Para disponer de importaciones completamente atómicas o supresiones públicas centralizadas, Lovable tendría que implementar el mecanismo correspondiente en el backend. No se añadieron migraciones fuera de su flujo.

## Sincronizador local

El script anterior con rutas fijas de Windows y clasificación inferida por nombre fue reemplazado por un sincronizador que comparte el lector y validador universal. Conserva todos los SKU anteriores y agrega las aplicaciones faltantes.

```sh
# Validar y ver resumen: no escribe archivos.
bun run sync:catalogo --input /ruta/catalogo.xlsx

# Guardar el catálogo combinado en una salida explícita.
bun run sync:catalogo --input /ruta/catalogo.xlsx --output /ruta/catalogo-combinado.json --write
```

`sync:filtros` sigue siendo un alias del mismo sincronizador. Sin `--output`, el destino es `src/data/filtros.json`; sin `--write`, siempre es solo lectura. Si el destino no existe, parte del catálogo verificado incluido en el repositorio. El guardado usa un archivo temporal y renombrado; no elimina SKU que no estén en la planilla. El script no crea declaraciones nuevas de homologación.

## Verificación reproducible

```sh
npm run typecheck
npm test
npm run build
npm run lint
```

Las pruebas cubren resolución por ID, enlaces anteriores, categorías dinámicas, compatibilidad modelo/año, preservación de 52 SKU y 132 aplicaciones, Excel/XLS/CSV, múltiples hojas, formatos de código, fórmulas, plantilla de ida y vuelta, 20.000 aplicaciones repetidas, vista previa sin escrituras, permisos, campos vacíos, reimportación y errores parciales. Los tests de interfaz cubren selección de hojas, confirmación, búsqueda, errores y paginación.

Las pruebas de persistencia utilizan un almacén simulado y verifican las operaciones del ejecutor. No equivalen a una prueba contra las políticas RLS desplegadas. La comprobación final con una cuenta autorizada y el backend real debe realizarse en el entorno de revisión de Lovable antes de incorporar la rama.

### Resultado de esta implementación

| Comprobación                          | Resultado                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, incluidos scripts         | Aprobado (`npm run typecheck`).                                                                                                                                                                                      |
| Vitest                                | 111 pruebas aprobadas en 9 archivos.                                                                                                                                                                                 |
| Build de producción                   | Aprobado (`npm run build`); quedan avisos del stack existente.                                                                                                                                                       |
| ESLint de archivos modificados/nuevos | Sin errores; un aviso de Fast Refresh en la estructura existente de Inicio.                                                                                                                                          |
| ESLint global                         | No pasa: 998 errores de formato en archivos sin modificar y 13 avisos de Fast Refresh. No se reescribieron archivos generados para corregir formato.                                                                 |
| Catálogo verificado                   | El blob de `src/data/filtros.json` es idéntico al de la base: `27e20b425cbe09e767b81a0683b41c13041697ba`.                                                                                                            |
| CLI universal                         | Vista previa sin escritura, 52 productos previos íntegros al agregar uno y reimportación sin duplicar aplicaciones. Ejecutado con Node y el cargador TypeScript disponible; Bun no estaba instalado en este entorno. |
| Navegador real                        | Intentado con Playwright; Chromium no pudo iniciar por restricciones de sockets del entorno. No se obtuvieron capturas.                                                                                              |
| Backend real                          | No se realizaron escrituras ni pruebas de extremo a extremo con cuentas productivas.                                                                                                                                 |

Se mantienen intactos `AGENTS.md`, `bun.lock`, `vite.config.ts`, `drizzle/`, `supabase/`, `src/integrations/` y `src/routeTree.gen.ts`. La rama se entrega para revisión; no se publica el sitio ni se fusiona con `main`.
