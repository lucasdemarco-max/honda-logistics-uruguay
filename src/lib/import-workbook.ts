import * as XLSX from "xlsx";
import {
  importFieldForHeader,
  normalizeImportValue,
  type ImportField,
  type ImportRecord,
} from "./admin-import";

// Vite loads SheetJS's ESM build; Node CLI can receive its CommonJS namespace.
const numberFormats: typeof XLSX.SSF = XLSX.SSF ?? Reflect.get(XLSX, "default")?.SSF;

// Bound the work performed in a browser before allowing a catalog write.
export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_IMPORT_SHEETS = 100;
const HEADER_SCAN_ROWS = 50;

export interface ImportSheetSummary {
  name: string;
  headerRow: number;
  rowCount: number;
}

export interface ImportWorkbookResult {
  records: ImportRecord[];
  sheets: ImportSheetSummary[];
  ignoredSheets: string[];
}

export function validateImportFile(fileName: string, size: number): void {
  if (!/\.(xlsx|xls|csv)$/i.test(fileName)) throw new Error("Elegí un archivo .xlsx, .xls o .csv");
  if (!Number.isFinite(size) || size <= 0) throw new Error("El archivo está vacío");
  if (size > MAX_IMPORT_FILE_BYTES) throw new Error("El archivo supera el límite de 20 MB");
}

const textFields = new Set<ImportField>(["sku", "hondaCode", "categoryId", "modelId"]);
const emptyCell = (cell: XLSX.CellObject | undefined) =>
  !cell || (!cell.f && cell.t !== "e" && String(cell.v ?? "").trim() === "");

function cellValue(
  cell: XLSX.CellObject | undefined,
  field: ImportField | undefined,
  address: string,
): unknown {
  if (!cell) return "";
  if (cell.t === "e") throw new Error(`${address}: la celda contiene un error de Excel`);
  if (cell.f && cell.v === undefined)
    throw new Error(`${address}: recalculá y guardá la fórmula en Excel antes de importar`);
  if (field && textFields.has(field)) {
    if (cell.t === "d" || (cell.z && numberFormats.is_date(cell.z))) {
      throw new Error(
        `${address}: los códigos no pueden tener formato de fecha; guardalos como texto`,
      );
    }
    if (cell.t === "n") {
      if (!Number.isSafeInteger(cell.v)) {
        throw new Error(
          `${address}: guardá los códigos como texto para evitar pérdida de precisión`,
        );
      }
      const raw = String(cell.v);
      const formatted = XLSX.utils.format_cell(cell);
      // Formatting is presentation, not identity: grouping/currency/scientific formats
      // must never turn SKU 1234 into another SKU such as "1,234" or "$1,234".
      // Preserve only an unambiguous zero-padded integer, even when cellNF was omitted.
      return /^0+\d+$/.test(formatted) &&
        Number(formatted) === cell.v &&
        formatted.length > raw.length
        ? formatted
        : raw;
    }
  }
  return cell.v ?? "";
}

/** Read every product sheet; no persistence, network access, formula evaluation or schema writes. */
export function readImportWorkbook(workbook: XLSX.WorkBook): ImportWorkbookResult {
  if (workbook.SheetNames.length > MAX_IMPORT_SHEETS)
    throw new Error("El archivo supera el límite de 100 hojas");
  const records: ImportRecord[] = [];
  const sheets: ImportSheetSummary[] = [];
  const ignoredSheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) {
      ignoredSheets.push(sheetName);
      continue;
    }
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.c - range.s.c + 1 > MAX_IMPORT_COLUMNS)
      throw new Error(`${sheetName}: la hoja supera el límite de 100 columnas`);
    if (range.e.r - range.s.r + 1 > MAX_IMPORT_ROWS + HEADER_SCAN_ROWS)
      throw new Error(`${sheetName}: la hoja supera el límite de 20.000 filas de datos`);
    let headerIndex = -1;
    let headers: string[] = [];
    let sawSku = false;
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + HEADER_SCAN_ROWS - 1); r++) {
      const rowHeaders = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) =>
        String(sheet[XLSX.utils.encode_cell({ r, c: range.s.c + offset })]?.v ?? "").trim(),
      );
      const fields = rowHeaders.map(importFieldForHeader);
      if (fields.includes("sku")) sawSku = true;
      if (fields.includes("sku") && fields.includes("name")) {
        headerIndex = r;
        headers = rowHeaders;
        break;
      }
    }
    if (headerIndex < 0) {
      const likelyProducts = /^(productos?|catalogo|repuestos?|filtros?)$/i.test(
        normalizeImportValue(sheetName),
      );
      if (sawSku || likelyProducts)
        throw new Error(
          `${sheetName}: no encontramos encabezados SKU y Nombre en las primeras 50 filas`,
        );
      ignoredSheets.push(sheetName);
      continue;
    }
    const logicalHeaders = new Set<string>();
    for (const header of headers) {
      if (!header) continue;
      const identity = importFieldForHeader(header) ?? normalizeImportValue(header);
      if (logicalHeaders.has(identity))
        throw new Error(
          `${sheetName} · Fila ${headerIndex + 1}: encabezado duplicado o ambiguo: ${header}`,
        );
      logicalHeaders.add(identity);
    }
    let rowCount = 0;
    for (let r = headerIndex + 1; r <= range.e.r; r++) {
      const cells = headers.map(
        (_, offset) =>
          sheet[XLSX.utils.encode_cell({ r, c: range.s.c + offset })] as
            XLSX.CellObject | undefined,
      );
      if (cells.every(emptyCell)) continue;
      const record: Record<string, unknown> = {};
      headers.forEach((header, offset) => {
        const cell = cells[offset];
        const address = `${sheetName}!${XLSX.utils.encode_cell({ r, c: range.s.c + offset })}`;
        if (!header) {
          if (!emptyCell(cell))
            throw new Error(`${address}: hay datos en una columna sin encabezado`);
          return;
        }
        record[header] = cellValue(cell, importFieldForHeader(header), address);
      });
      records.push({ rowNumber: r + 1, sheetName, record });
      rowCount++;
      if (records.length > MAX_IMPORT_ROWS)
        throw new Error(
          "El archivo supera el límite de 20.000 filas de productos entre todas las hojas",
        );
    }
    sheets.push({ name: sheetName, headerRow: headerIndex + 1, rowCount });
  }
  if (!sheets.length)
    throw new Error("No encontramos hojas de productos con columnas SKU y Nombre");
  if (!records.length) throw new Error("Las hojas de productos no contienen filas para importar");
  return { records, sheets, ignoredSheets };
}
