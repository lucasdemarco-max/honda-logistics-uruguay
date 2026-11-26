import * as XLSX from "xlsx";

export const CASE_SOURCE_NAME = "WEB - Casos de Clientes.xlsx";
// Replace this file through Administración → Actualizar casos desde Excel.
// Never place the raw file in /public or commit customer/chassis data to GitHub.
export const REQUIRED_CASE_COLUMNS = [
  "Nro de CPED", "Caso Min", "Cliente", "Chasis", "Tipo de Vehiculo",
  "Responsable Solicitante", "Area Solicitante", "SKU", "Descripcion",
  "Qty Solicitada", "Status del Documento", "Estado 01", "Estado 02",
  "Factura Asociada",
] as const;

export interface CasePartLine {
  sku: string;
  description: string;
  quantity: string;
  document_status: string;
  line_status: string;
  logistics_status: string;
  related_document: string;
}

export interface CaseSnapshot {
  case_min: string;
  cped: string;
  customer_name: string;
  chassis: string;
  vehicle_type: string;
  vehicle_version: string;
  requester: string;
  requester_area: string;
  lines: CasePartLine[];
  source_file: string;
}

export function normalizeCaseMin(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{5}$/.test(raw)) return null;
  return raw;
}

const toText = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const normalHeader = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseCaseWorkbook(buffer: ArrayBuffer, sourceFile: string): CaseSnapshot[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error("El archivo no contiene hojas de casos.");
  const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" });
  const first = values[0];
  if (!first) throw new Error("El archivo de casos está vacío.");

  const columnNames = Object.keys(first);
  const matchingColumn = (name: string) =>
    columnNames.find((key) => normalHeader(key) === normalHeader(name));
  const missing = REQUIRED_CASE_COLUMNS.filter((name) => !matchingColumn(name));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}`);
  const get = (row: Record<string, unknown>, name: string) => toText(row[matchingColumn(name)!]);

  const result = new Map<string, CaseSnapshot>();
  for (const [index, row] of values.entries()) {
    const rawNumber = get(row, "Caso Min");
    const caseMin = normalizeCaseMin(rawNumber);
    if (!caseMin) throw new Error(`Fila ${index + 2}: Caso Min inválido (${rawNumber || "vacío"}).`);
    const cped = get(row, "Nro de CPED");
    if (!cped) throw new Error(`Fila ${index + 2}: Nro de CPED vacío.`);

    let record = result.get(caseMin);
    if (!record) {
      record = {
        case_min: caseMin, cped,
        customer_name: get(row, "Cliente"),
        chassis: get(row, "Chasis"),
        vehicle_type: get(row, "Tipo de Vehiculo"),
        vehicle_version: get(row, "Version"),
        requester: get(row, "Responsable Solicitante"),
        requester_area: get(row, "Area Solicitante"),
        lines: [],
        source_file: sourceFile,
      };
      result.set(caseMin, record);
    } else if (record.cped !== cped) {
      throw new Error(`Fila ${index + 2}: el Caso Min ${caseMin} identifica más de un CPED.`);
    }

    record.lines.push({
      sku: get(row, "SKU"),
      description: get(row, "Descripcion"),
      quantity: get(row, "Qty Solicitada"),
      document_status: get(row, "Status del Documento"),
      line_status: get(row, "Estado 01"),
      logistics_status: get(row, "Estado 02"),
      related_document: get(row, "Factura Asociada"),
    });
  }
  return [...result.values()];
}
