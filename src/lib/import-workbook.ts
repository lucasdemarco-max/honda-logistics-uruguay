import * as XLSX from "xlsx";
import { importColumn, type ImportColumn, type ImportRecord } from "@/lib/admin-import";

const MAX_IMPORT_ROWS = 20000;
const MAX_IMPORT_COLUMNS = 256;
function headerLocation(
  sheet: XLSX.WorkSheet,
): { headers: string[]; row: number; startColumn: number } | null {
  if (!sheet["!ref"]) return null;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (range.e.c - range.s.c + 1 > MAX_IMPORT_COLUMNS)
    throw new Error(
      `La hoja supera ${MAX_IMPORT_COLUMNS} columnas; exportá solo las columnas del catálogo`,
    );
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 19); row += 1) {
    const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) =>
      String(sheet[XLSX.utils.encode_cell({ r: row, c: range.s.c + index })]?.v ?? "").trim(),
    );
    const columns = headers.map(importColumn);
    if (columns.includes("sku") && columns.includes("name"))
      return { headers, row, startColumn: range.s.c };
  }
  return null;
}
export function detectImportSheet(workbook: XLSX.WorkBook): string {
  return (
    workbook.SheetNames.find((name) => {
      try {
        return Boolean(headerLocation(workbook.Sheets[name]!));
      } catch {
        return false;
      }
    }) ??
    workbook.SheetNames[0] ??
    ""
  );
}
export function readImportSheet(workbook: XLSX.WorkBook, sheetName: string): ImportRecord[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("La hoja seleccionada no existe");
  const header = headerLocation(sheet);
  if (!header)
    throw new Error("No encontramos encabezados SKU y Nombre/Name en las primeras 20 filas");
  const columns = header.headers.map(importColumn);
  const counts = new Map<ImportColumn, number>();
  columns.forEach((column) => {
    if (column) counts.set(column, (counts.get(column) ?? 0) + 1);
  });
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([column]) => column);
  if (duplicates.length)
    throw new Error(`Encabezados duplicados o equivalentes: ${duplicates.join(", ")}`);
  if (
    !columns.some(
      (column) => column === "categoryId" || column === "categoryName" || column === "subcategory",
    )
  )
    throw new Error("Falta una columna CategoryID o CategoryName/Categoría");
  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  if (range.e.r - header.row > MAX_IMPORT_ROWS)
    throw new Error(
      `La hoja supera el límite de ${MAX_IMPORT_ROWS} filas; dividila en archivos más pequeños`,
    );
  const records: ImportRecord[] = [];
  for (let row = header.row + 1; row <= range.e.r; row += 1) {
    const record: Record<string, unknown> = {};
    header.headers.forEach((name, index) => {
      if (!name) return;
      const column = columns[index];
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: header.startColumn + index })];
      if (column && cell?.t === "e")
        throw new Error(
          `Fila ${row + 1}, ${name}: la celda contiene un error de Excel; corregila antes de importar`,
        );
      if (column && cell?.f)
        throw new Error(
          `Fila ${row + 1}, ${name}: reemplazá la fórmula por su valor antes de importar`,
        );
      const numberFormat = typeof cell?.z === "number" ? XLSX.SSF.get_table()[cell.z] : cell?.z;
      if (
        column &&
        (cell?.t === "d" || (typeof numberFormat === "string" && XLSX.SSF.is_date(numberFormat)))
      )
        throw new Error(
          `Fila ${row + 1}, ${name}: usá texto para códigos o números para importes y años, no una fecha de Excel`,
        );
      let value: unknown = cell?.v ?? "";
      if (
        column &&
        ["sku", "hondaCode", "categoryId", "modelId"].includes(column) &&
        typeof value === "number"
      ) {
        if (!Number.isSafeInteger(value) || Math.abs(value) >= 1e15)
          throw new Error(
            `Fila ${row + 1}, ${name}: el identificador perdió precisión; guardalo como texto`,
          );
        const formatted = String(cell?.w ?? "");
        value = /^\d+$/.test(formatted) && Number(formatted) === value ? formatted : String(value);
      }
      record[name] = value;
    });
    if (
      Object.entries(record).some(
        ([name, value]) => importColumn(name) && String(value ?? "").trim(),
      )
    )
      records.push({ rowNumber: row + 1, record });
  }
  if (!records.length) throw new Error("La hoja no contiene filas de productos");
  return records;
}
