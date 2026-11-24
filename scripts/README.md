# Sincronizador universal Excel → catálogo local

El sincronizador usa la misma validación que la importación administrativa. Requiere Bun y las dependencias del proyecto instaladas. Acepta archivos `.xlsx`, `.xls` y `.csv`; no accede a la base de datos ni cambia su esquema.

## Uso

Primero validá la planilla y revisá el resumen:

```sh
bun scripts/generate-catalog-data.ts --input /ruta/Repuestos.xlsx --output /ruta/catalogo-revisado.json --sheet Productos --dry-run
```

Para generar el archivo revisable, repetí el comando sin `--dry-run`. La opción `--output` es obligatoria. Si varias hojas tienen productos, indicá el nombre exacto con `--sheet`. Una hoja puede tener un título antes de los encabezados, siempre que estos estén dentro de las primeras 20 filas.

`npm run sync:filtros -- --input ... --output ...` sigue disponible y ejecuta el mismo importador universal.

## Identificadores y columnas

Cada fila requiere `SKU`, `Name`/`Nombre` y `CategoryID` o `CategoryName`. Para una categoría nueva, incluí su `CategoryName`. Podés usar cualquier categoría, sin una lista fija de tipos de repuesto.

`ModelID` y `CategoryID` identifican un modelo o categoría existente por ID exacto o por su `slug`. Los códigos externos nuevos se mantienen como identificadores legibles; un UUID desconocido se rechaza. `ModelName` y `CategoryName` aportan los nombres que se mostrarán. Nunca se usa el nombre del producto para inferir su categoría.

Si indicás `ModelID` o `ModelName`, también son obligatorios `YearFrom` y `YearTo`. Repetí el SKU para agregar aplicaciones por modelo/años. Sin un modelo explícito, no se afirma compatibilidad universal.

Los campos opcionales son `HondaCode`, `Description`, `Price`, `Stock`, `Availability`, `Active` y `CompatibilityNotes`. Se aceptan los alias en español de la plantilla administrativa. Guardá los códigos largos como texto en Excel para evitar pérdida de precisión. Las fórmulas deben reemplazarse por valores antes de importar.

## Conservación de datos

- Un archivo de salida existente se usa como base. Para un destino nuevo se usa `src/data/filtros.json`, o el archivo indicado con `--base`. No se permite reemplazar la base de un destino existente por otra.
- Se actualizan únicamente los SKU presentes en la planilla y se agregan aplicaciones explícitas. Los demás productos y aplicaciones se conservan.
- Un campo opcional vacío conserva el valor previo. Un cero explícito en precio o stock es válido. Un producto nuevo sin precio o stock queda sin dato.
- Las imágenes, marcas, referencias de homologación y demás campos fuera de la planilla se conservan. No se genera una homologación ni un stock a partir del nombre del artículo.
- En filas repetidas del mismo SKU se usa el mayor precio informado. Los otros valores explícitos deben coincidir. Las notas de una aplicación existente no se sustituyen por una nota contradictoria.
- Reimportar el mismo archivo no duplica aplicaciones ni cambia sus datos. Una fila inválida cancela toda la escritura; el destino se reemplaza sólo después de validar el resultado completo.

Los identificadores locales de nuevas entidades llevan prefijos `local-product:`, `local-category:` y `local-model:`. Son identificadores del archivo JSON; la importación administrativa resuelve las claves UUID de las tablas existentes por separado.

El archivo de salida es un artefacto para revisar. El comando no publica el sitio, no escribe en GitHub ni fusiona ramas.
