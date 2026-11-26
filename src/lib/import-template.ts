import * as XLSX from "xlsx";
import type { CatalogLookup } from "./admin-import";

export function createImportTemplate(
  categories: CatalogLookup[],
  models: CatalogLookup[],
): XLSX.WorkBook {
  const headers = [
    "SKU",
    "Name",
    "CategoryID",
    "CategoryName",
    "HondaCode",
    "Description",
    "Price",
    "Stock",
    "Availability",
    "Active",
    "ModelID",
    "ModelName",
    "YearFrom",
    "YearTo",
    "CompatibilityNotes",
  ];
  const productSheet = XLSX.utils.aoa_to_sheet([headers]);
  productSheet["!cols"] = headers.map(() => ({ wch: 22 }));
  const instructions = XLSX.utils.aoa_to_sheet([
    ["Plantilla universal · Honda Logistics Uruguay"],
    ["Ingresá una fila por aplicación y repetí el SKU para otros modelos o rangos de años."],
    ["Podés incluir varias hojas de productos y títulos antes del encabezado (primeras 50 filas)."],
    [
      "CategoryID y ModelID: UUID existente o código exacto de la hoja de referencia. Los IDs tienen prioridad.",
    ],
    [
      "Para una categoría nueva, indicá CategoryID y CategoryName. Modelos nuevos: ModelID y, preferentemente, ModelName.",
    ],
    [
      "Los códigos nuevos se guardan como códigos estables; el sistema asigna el UUID interno. No inventes UUID.",
    ],
    ["Un producto no se clasifica por su nombre. CategoryID/CategoryName determinan la categoría."],
    ["Si indicás modelo, YearFrom y YearTo son obligatorios, enteros entre 1970 y 2100."],
    ["Dejá modelo y años vacíos si no hay aplicación verificada. No se interpreta como universal."],
    [
      "Campos opcionales vacíos conservan el dato guardado; en un producto nuevo quedan sin dato o con el valor predeterminado.",
    ],
    [
      "Stock=0, Price=0 y Active=no son valores explícitos. La disponibilidad solo cambia si se indica.",
    ],
    [
      "SKU repetido: mismos datos del producto. Precios diferentes usan el mayor y se avisa; el stock no se suma.",
    ],
    [
      "Las compatibilidades anteriores se conservan; se agregan aplicaciones faltantes sin borrar rangos ni notas.",
    ],
    [
      "La vista previa no guarda. Revisá hojas, categorías nuevas, modelos nuevos y errores antes de confirmar.",
    ],
    ["SKU y códigos: formato Texto en Excel para conservar ceros iniciales. Moneda: UYU."],
    ["Availability", "en_stock", "pocas_unidades", "a_pedido", "sin_stock", "consultar"],
    ["Active", "sí / no, true / false, 1 / 0"],
    ["Límites", "20 MB, 20.000 filas de productos, 100 columnas por hoja, 100 hojas"],
  ]);
  instructions["!cols"] = [{ wch: 110 }, { wch: 35 }];
  const categorySheet = XLSX.utils.aoa_to_sheet([
    ["CategoryID (UUID)", "Código de categoría", "CategoryName"],
    ...categories.map((value) => [value.id, value.slug, value.name]),
  ]);
  const modelSheet = XLSX.utils.aoa_to_sheet([
    ["ModelID (UUID)", "Código de modelo", "ModelName"],
    ...models.map((value) => [value.id, value.slug, value.name]),
  ]);
  for (const sheet of [categorySheet, modelSheet])
    sheet["!cols"] = [{ wch: 40 }, { wch: 26 }, { wch: 32 }];
  const file = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(file, productSheet, "Productos");
  XLSX.utils.book_append_sheet(file, instructions, "Instrucciones");
  XLSX.utils.book_append_sheet(file, categorySheet, "Categorias");
  XLSX.utils.book_append_sheet(file, modelSheet, "Modelos");
  return file;
}
