# Catálogo por modelo y categoría — implementación de prueba

Rama: `feature/catalogo-modelid-categoryid-excel`. No fusionar con `main` antes de revisar en Antigravity/Lovable.

## Navegación

1. Elegir modelo Honda (equivalente a `ModelID`).
2. Opcional: elegir año.
3. Mostrar las categorías con productos asociados a ese modelo.
4. Elegir una categoría (`CategoryID`) para ver artículos, precios y compatibilidad.

Las categorías se generan a partir de productos recibidos en la consulta, sin lista cerrada en el componente. Los filtros locales originales se mantienen en `src/data/filtros.json`; si se importa el mismo SKU a Supabase, el registro de Supabase tiene prioridad visual.

## Formato Excel

Primera hoja, encabezados en la primera fila. Se admite `.xlsx`, `.xls` y `.csv`.

| Campo | Obligatorio | Uso |
| --- | --- | --- |
| SKU | Sí | Identificador único del artículo |
| NAME o Nombre | Sí | Nombre comercial |
| CategoryID | Recomendado | ID externo del archivo; no se confunde con el UUID de la base |
| CategoryName | Sí para una categoría nueva | Nombre de familia visible, p. ej. Fluidos, Correas |
| ModelID | Recomendado | Modelo Honda, p. ej. CR-V, HR-V |
| YearFrom y YearTo | Sí si se especifica ModelID | Años de la aplicación declarada |
| Price, Stock, availability | No | Valores a revisar antes de usar comercialmente |
| HondaCode, Description | No | Identificación y detalle técnico |

Un mismo SKU puede tener varias filas para diferentes modelos. La vista previa comprueba duplicados y errores antes de confirmar. Las categorías y modelos nuevos se registran al confirmar la importación, nunca al abrir el archivo. Los SKU existentes se actualizan; los demás SKU se conservan. Las compatibilidades existentes no se eliminan: solo se añaden combinaciones de modelo y rango de año que falten.

**Limitación conocida:** el ID externo `CategoryID` no se almacena actualmente como campo separado en Supabase; la identidad entre archivos se conserva por el nombre/slug de categoría. Si un proveedor entrega ID numérico, aportar también `CategoryName`. No alterar el esquema de `drizzle/` directamente: ese esquema pertenece a Lovable.

**Limitación conocida:** `search_products` tiene un límite de 200 productos por consulta definido en la base de datos Lovable; para catálogos mayores habrá que coordinar paginación con Lovable.

## Validación pendiente antes de pasar a main

- Ejecutar `npm install`, `npm test`, `npm run lint`, `npm run build` en un entorno con dependencias disponibles.
- Probar un Excel de filtros, uno de correas y uno de fluidos con varios `ModelID`.
- Reimportar el mismo archivo y comprobar que no duplica compatibilidades.
- Verificar que los 52 productos de filtros existentes siguen visibles.
- Confirmar en Supabase que los permisos RLS impiden importaciones no autorizadas.
- Probar diseño móvil y carrito en Antigravity/Lovable.

No añadir claves ni archivos `.env` nuevos al repositorio.
