# Fuentes del catálogo WEB - Fichas (26/11/2026)

Esta versión incorpora **16 categorías** en `src/data/catalogo-web-fichas.json`, provenientes de 17 libros Excel recibidos. La navegación usa el campo `Modelo` como ModelID, el campo `CategoryID` como nombre completo de la familia, y `CategoryName` como abreviatura. `Honda Code` es el código Honda del producto.

## Punto de actualización

Los libros originales **no se renombraron ni se modificaron** y se entregan juntos en el archivo `Honda_Logistics_Fuentes_Excel_2026-11-26.zip` del chat. El código del proyecto usa `src/data/catalogo-web-fichas.json` como instantánea normalizada; ese JSON es el punto de actualización consumido por la aplicación. Para una actualización nueva, reemplazar el libro correspondiente manteniendo su mismo nombre y regenerar/validar el JSON antes de publicar.

Los paths temporales de carga `/mnt/data/...` corresponden a esta sesión, no son enlaces permanentes a la computadora del usuario ni a GitHub. Para mantener fuentes editables a largo plazo, copiar los libros originales a una carpeta persistente del proyecto o al repositorio (por ejemplo `catalog-sources/`) y sincronizar las versiones futuras allí. **No se han guardado los originales binarios en GitHub.**

Archivos originales recibidos:
- `WEB - Fichas - Espejos Retrovisores.xls`
- `WEB - Fichas - Filtros.xls`
- `WEB - Fichas - Fluidos.xls`
- `WEB - Fichas - Frenos.xls`
- `WEB - Fichas - Guardabarros.xls`
- `WEB - Fichas - Logos y Emblemas.xls`
- `WEB - Fichas - Lunetas.xls`
- `WEB - Fichas - Opticas y Faros.xls`
- `WEB - Fichas - Paneles de Carroceria.xls`
- `WEB - Fichas - Paragolpes.xls`
- `WEB - Fichas - Parrillas.xls`
- `WEB - Fichas - Pasarruedas.xls`
- `WEB - Fichas - Prabrisas.xls`
- `WEB - Fichas - Puertas.xls`
- `WEB - Fichas - Refrigeracion.xls`
- `WEB - Fichas - Sensores.xls`
- `WEB - Fichas - Tapas de Baul.xls`

## Control de calidad

- Total recibido: 1558 filas de aplicación (incluye filas repetidas por modelos).
- Aceptadas en la instantánea: 1482 filas.
- Productos únicos en la instantánea: 1240.
- `WEB - Fichas - Tapas de Baul.xls` contiene 69 filas `CategoryID=Sensores`; no se publicaron como tapas de baúl.
- Se apartaron 6 aplicaciones con conflictos de SKU y una fila incompleta. Revisar el manifiesto de errores de la entrega antes de actualizar.
- Las fotos se muestran solamente si se aprueban por código Honda y se verifica visualmente que sean piezas originales con marca Honda. Los candidatos existentes no constituyen validación. Todo lo demás usa `Imagen no disponible`.
- No alterar archivos de migración o generados propiedad de Lovable; se mantiene la rama `feature/catalogo-modelid-categoryid-excel` separada de `main`.

## Actualizaciones futuras

1. Sustituir en la carpeta de fuentes el Excel de la categoría manteniendo nombre y columnas.
2. Validar SKU, Honda Code, Modelo, años, precios y categoría antes de generar nueva instantánea.
3. Actualizar únicamente los registros de esa categoría. Conservar las demás familias.
4. Inspeccionar diferencias y duplicados; no borrar por silencio.
5. Verificar la vista previa y recién entonces integrar mediante aprobación.
