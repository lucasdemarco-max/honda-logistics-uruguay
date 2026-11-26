# WEB - Fichas: libros originales

Colocá aquí los archivos originales `WEB - Fichas - *.xls` con sus nombres exactos y sin editarlos, extraídos del ZIP adjunto en el chat. Esta carpeta es el punto de actualización estable dentro del repositorio.

Ejecutá `npm run sync:web-fichas` (requiere Bun) para regenerar `src/data/catalogo-web-fichas.json`. Una planilla reemplaza solamente su propia categoría; las otras permanecen intactas. `WEB - Fichas - Tapas de Baul.xls` se rechaza mientras sus filas tengan CategoryID = Sensores.

Por limitaciones de transferencia los 17 archivos binarios aún no están incluidos en esta rama; se entregaron íntegros en `Honda_Logistics_Fuentes_Excel_2026-11-26.zip`.
