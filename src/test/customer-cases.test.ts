import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { normalizeCaseMin, parseCaseWorkbook } from "@/lib/customer-cases";

const header = [
  "Nro de CPED", "Caso Min", "Cliente", "Chasis", "Tipo de Vehiculo",
  "Version", "Responsable Solicitante", "Area Solicitante", "SKU",
  "Descripcion", "Qty Solicitada", "Status del Documento",
  "Estado 01", "Estado 02", "Factura Asociada",
];

function workbook(rows: string[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...rows]), "Casos");
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buffer;
}

describe("case workbook import", () => {
  it("normalizes five digits to six without losing zeroes", () => {
    expect(normalizeCaseMin("01043")).toBe("001043");
    expect(normalizeCaseMin("001043")).toBe("001043");
    expect(normalizeCaseMin("1043")).toBeNull();
    expect(normalizeCaseMin("0001043")).toBeNull();
    expect(normalizeCaseMin("abc123")).toBeNull();
  });

  it("groups all parts under the case instead of replacing lines", () => {
    const buffer = workbook([
      ["X 0021 - 00001043", "01043", "Cliente A", "VIN-ONE", "ABC1234", "RIDGELINE", "Asesor A", "Suc Logistics", "39627", "Flexible", "1", "ABIERTO", "En proceso", "En transito", ""],
      ["X 0021 - 00001043", "01043", "Cliente A", "VIN-ONE", "ABC1234", "RIDGELINE", "Asesor A", "Suc Logistics", "39628", "Freno", "2", "ABIERTO", "Pendiente", "", "F 100"],
    ]);
    const parsed = parseCaseWorkbook(buffer, "casos.xlsx");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.case_min).toBe("001043");
    expect(parsed[0]?.cped).toBe("X 0021 - 00001043");
    expect(parsed[0]?.vehicle_version).toBe("RIDGELINE");
    expect(parsed[0]?.lines).toHaveLength(2);
    expect(parsed[0]?.lines[1]?.sku).toBe("39628");
    expect(parsed[0]?.lines[1]?.related_document).toBe("F 100");
  });

  it("refuses a repeated case number assigned to a different CPED", () => {
    const buffer = workbook([
      ["X 0021 - 00001043", "01043", "", "", "", "", "", "", "1", "A", "1", "", "", "", ""],
      ["X 0021 - 00001044", "01043", "", "", "", "", "", "", "2", "B", "1", "", "", "", ""],
    ]);
    expect(() => parseCaseWorkbook(buffer, "casos.xlsx")).toThrow(/más de un CPED/);
  });
});
