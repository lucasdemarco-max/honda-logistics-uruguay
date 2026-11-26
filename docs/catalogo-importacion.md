# Catálogo por ModelID y CategoryID

## Alcance

El acceso principal sigue la secuencia modelo → categoría → repuestos. El año se usa como filtro adicional y la búsqueda por código Honda, SKU o nombre queda disponible como alternativa. Las categorías visibles y sus cantidades se obtienen de los productos con aplicaciones explícitas para el modelo y año seleccionados. Una pieza con varias aplicaciones se cuenta una sola vez en cada categoría.

Inicio y catálogo usan los modelos y categorías disponibles, sin listas fijas de vehículos ni reglas que deduzcan una categoría a partir del nombre de la pieza. Las categorías nuevas pueden cargarse desde el panel administrativo utilizando las tablas que ya existen.

Las URL nuevas usan `modelId` y `categoryId`. También se admiten `ModelID`, `CategoryID` y los enlaces anteriores con `modelo` y `categoria`. El enlace anterior `categoria=filtros` conserva su alcance general sobre los tipos de filtros del catálogo existente. Seleccionar una categoría conserva el modelo; cambiar de modelo reinicia categoría y año.

## Identificadores

| Dato                  | Significado                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SKU`                 | Identidad del producto. Actualiza el mismo artículo y permite repetir filas para añadir aplicaciones.             |
| `CategoryID`          | UUID existente de `categories.id` o identificador externo guardado como `categories.slug`.                        |
| `CategoryName`        | Nombre visible. Es obligatorio para una categoría nueva.                                                          |
| `ModelID`             | UUID existente de `vehicle_models.id` o identificador externo guardado como `vehicle_models.slug`.                |
| `ModelName`           | Nombre visible del modelo o plataforma. Si se omite al crear un modelo mediante un código, se muestra ese código. |
| `YearFrom` / `YearTo` | Intervalo explícito de la aplicación del modelo, ambos extremos incluidos.                                        |

No se agregan columnas ni se sustituyen UUID. Un código externo como `civic-fc` se conserva en el `slug` y se relaciona con el UUID que genera la base al crear la fila. Se normalizan las mayúsculas a minúsculas para estos códigos; no se eliminan los signos permitidos que distinguen identificadores (`-`, `_`, `.`). Los códigos numéricos con ceros iniciales deben conservarse como texto o con su formato de ceros.

Un UUID desconocido, un identificador ambiguo o un ID que contradiga el nombre existente se rechaza. No se reasigna a otra entidad por semejanza. Para evitar equivocaciones, la plantilla incluye hojas de consulta con los UUID, nombres y slugs de categorías y modelos actuales.

## Importación administrativa

1. Descargar la plantilla o elegir una planilla `.xlsx`, `.xls` o `.csv` con los encabezados admitidos.
2. Elegir la hoja que contiene los productos. Se reconocen encabezados dentro de sus primeras 20 filas.
3. Revisar la vista previa, los errores y las categorías/modelos que se crearán. Leer el archivo o cambiar de hoja no escribe datos.
4. Corregir todas las filas inválidas. El panel permite descargar el detalle de errores.
5. Confirmar la importación. El servicio vuelve a comprobar la sesión, el permiso `catalogo` y los datos antes de guardar. Las políticas RLS existentes siguen aplicándose a las escrituras.

Campos mínimos: `SKU`, `Name`/`Nombre` y una categoría identificada por `CategoryID` o `CategoryName`. Para un nuevo `CategoryID` también se necesita `CategoryName`. Si se incluye un modelo son obligatorios ambos años. Una fila sin modelo no declara compatibilidad universal y no elimina aplicaciones previas.

Campos opcionales: `HondaCode`, `Description`, `Price`, `Stock`, `Availability`, `Active` y `CompatibilityNotes`. Se conservan los encabezados equivalentes en español, como `Precio UYU`, `Código Honda` y `Año Desde`. La columna antigua `Subcategoría Filtros`, cuando se usa sin un `CategoryID` explícito, identifica una categoría dinámica por su nombre: no se colapsa automáticamente dentro de Filtros.

Ejemplo ilustrativo de estructura (no representa precio, stock ni compatibilidad real):

```text
SKU | Name | CategoryID | CategoryName | ModelID | ModelName | YearFrom | YearTo
PIEZA-EJEMPLO | Pieza de ejemplo | cat-ejemplo | Categoría de ejemplo | plataforma-ejemplo | Plataforma de ejemplo | 2020 | 2021
```

### Validaciones

- Precio no negativo en UYU, con hasta dos decimales; se reconocen formatos locales como `1.250,50`.
- Stock entero no negativo, dentro del rango admitido por la base de datos.
- Años enteros entre 1970 y 2100; el año inicial no puede superar al final.
- Disponibilidad explícita: `en_stock`, `pocas_unidades`, `a_pedido`, `sin_stock` o `consultar`, con sus alias en español. El cero del formato anterior conserva la interpretación `consultar`.
- Activo explícito: sí/no, verdadero/falso o 1/0.
- Las fórmulas y celdas con errores de Excel requieren corregirse o convertirse a valores antes de importar. No se confía en resultados de fórmulas que podrían estar desactualizados.
- Los identificadores numéricos que pueden haber perdido precisión requieren texto. No se transforman fechas en códigos.
- Encabezados duplicados/equivalentes y asociaciones contradictorias se rechazan.
- El panel admite hasta 20.000 filas, 256 columnas y 10 MB por archivo.

### Reglas de conservación

Se actualizan solamente los SKU incluidos. Los demás productos se mantienen. Los campos opcionales vacíos conservan el dato existente; un cero explícito actualiza precio o stock a cero. En un producto nuevo sin datos previos, los campos no informados conservan los valores nulos o predeterminados de la base, sin inventar precio ni stock.

Cuando un SKU aparece varias veces, sus datos explícitos deben ser coherentes. Se conserva la regla anterior de tomar el mayor precio informado entre sus filas, indicada en la plantilla. Las filas pueden aportar modelos o intervalos diferentes. Un conflicto entre notas de la misma aplicación requiere revisión antes de guardar.

Las compatibilidades se agregan mediante lectura y comparación previa. No se ejecuta un borrado general. Se pueden completar notas vacías, pero no sustituir una nota existente por una contradictoria. Volver a importar el mismo archivo en forma secuencial no duplica las aplicaciones.

Imágenes, marcas, promociones y referencias de homologación ajenas a la planilla permanecen en los productos existentes. Crear un registro nuevo desde Excel no le atribuye homologación Honda. Si se importa por primera vez a la base un SKU del catálogo local, sus datos previos se usan como base para evitar perder información al dejar celdas vacías.

La base actual no ofrece una transacción para toda la importación ni una restricción única compuesta en las compatibilidades. Si hay un error de red o permisos después de una escritura, el panel muestra el avance parcial y permite reintentar. Evitar importaciones simultáneas del mismo catálogo desde dos sesiones. La atomicidad completa y la garantía frente a importaciones concurrentes requieren un cambio de esquema gestionado en Lovable.

## Catálogo existente y consulta pública

`src/data/filtros.json` se mantiene intacto: conserva los 52 productos y sus aplicaciones originales. La consulta combina esa fuente con todos los productos activos de la base. No usa la función anterior `search_products`, que limitaba los resultados a 200; lee páginas ordenadas de productos y compatibilidades.

La unión se hace por SKU. Para un artículo presente en ambas fuentes, los campos de la base tienen prioridad y se conservan las aplicaciones explícitas de ambas fuentes. Los ejemplos continúan identificados como ejemplos y se muestran después de los productos reales. El modelo y el año deben coincidir dentro de la misma aplicación: no se mezclan los años de otro vehículo compatible.

Las lecturas públicas usan el cliente con clave publicable y RLS. Para impedir que un artículo local reaparezca cuando está desactivado en la base, un helper exclusivamente de servidor consulta sólo los SKU del archivo local con `active=false`. Usa el cliente de servicio ya generado por Lovable y no acepta una lista de SKU enviada por el navegador. No devuelve al público filas desactivadas ni sus datos. Si no se puede verificar su estado, la consulta falla de forma explícita en lugar de publicar datos posiblemente desactivados.

## Configuración y restricciones de Lovable

Se usa la integración Supabase existente, con `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` administradas por Lovable. Las dos primeras admiten sus variantes públicas `VITE_` donde corresponde. La clave de servicio se usa únicamente en servidor, nunca como variable `VITE_` ni como valor en el repositorio. Su disponibilidad debe verificarse en el entorno Lovable antes de integrar/publicar la rama; estas pruebas no usan las credenciales de producción.

Esta implementación no cambia `supabase/migrations/`, `drizzle/`, archivos generados, secretos, políticas RLS ni configuración de despliegue. No reescribe el historial publicado. La rama queda separada de `main`; integrar o publicar requiere la decisión del responsable del proyecto.

## Sincronización local opcional

El script anterior de filtros ahora delega en un sincronizador universal y portátil, sin rutas Windows incorporadas. Ver `scripts/README.md` para uso de `npm run sync:catalog`, `--input`, `--output`, `--sheet`, `--base` y `--dry-run`.

El sincronizador conserva la base existente, valida todo antes de escribir y genera un JSON para revisión. No importa ese JSON automáticamente a Supabase ni publica el sitio. Para modificar el catálogo que leen los clientes se utiliza la importación administrativa o se revisa expresamente un cambio del archivo local en GitHub.

## Verificación

La suite cubre navegación, consultas por ID, compatibilidad por modelo/año, conservación de fuentes, paginación, exclusión de inactivos, lectura de Excel/CSV, validación, importación sin borrados, reintentos, permisos y sincronización local. Los tests de integración usan clientes simulados; no escriben en la base de producción.

Comandos de revisión:

```sh
npm test
npx tsc --noEmit
npm run build
npm run lint
git diff --check
```

El repositorio de partida presenta errores de formato y otros avisos en su lint global. La revisión de la rama debe distinguir ese estado previo del lint de los archivos modificados. Los resultados concretos de esta entrega se registran en la descripción del pull request.
