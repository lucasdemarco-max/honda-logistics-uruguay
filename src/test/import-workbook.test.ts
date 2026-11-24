import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectImportSheet, readImportSheet } from "@/lib/import-workbook";

function workbook(rows: unknown[][], name = "Repuestos") {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return book;
}

describe("universal workbook reading", () => {
  it("detects product sheets after instructions and keeps physical row numbers and formatted codes", () => {
    const book = workbook([["Instrucciones"], ["Completá Productos"]], "Guía");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Catálogo Honda"],
      [],
      ["SKU", "Name", "CategoryName", "ModelID"],
      [31, "Repuesto", "Suspensión", "CIVIC"],
      [],
      ["000032", "Otro", "Frenos", "FIT"],
    ]);
    sheet["A4"] = { t: "n", v: 31, z: "000000", w: "000031" };
    XLSX.utils.book_append_sheet(book, sheet, "Productos");
    expect(detectImportSheet(book)).toBe("Productos");
    const rows = readImportSheet(book, "Productos");
    expect(rows.map((row) => row.rowNumber)).toEqual([4, 6]);
    expect(rows[0]?.record["SKU"]).toBe("000031");
  });
  it("rejects duplicate aliases and absent category columns", () => {
    expect(() =>
      readImportSheet(workbook([["SKU", "Name", "Nombre", "CategoryName"]]), "Repuestos"),
    ).toThrow("duplicados");
    expect(() =>
      readImportSheet(
        workbook([
          ["SKU", "Name"],
          ["1", "Uno"],
        ]),
        "Repuestos",
      ),
    ).toThrow("CategoryID");
  });
  it("rejects formulas and precision loss in IDs before allowing writes", () => {
    const book = workbook([
      ["SKU", "Name", "CategoryID"],
      [1, "Repuesto", "frenos"],
    ]);
    book.Sheets["Repuestos"]!["A2"] = { t: "n", v: 1, f: "1+0" };
    expect(() => readImportSheet(book, "Repuestos")).toThrow("fórmula");
    book.Sheets["Repuestos"]!["A2"] = { t: "n", v: 1234567890123450 };
    expect(() => readImportSheet(book, "Repuestos")).toThrow("precisión");
  });
  it("reads actual XLSX, XLS and semicolon-separated CSV workbooks", () => {
    const source = workbook([
      ["SKU", "Name", "CategoryID"],
      ["0001", "Bujía", "encendido"],
    ]);
    for (const bookType of ["xlsx", "biff8"] as const) {
      const data = XLSX.write(source, { type: "array", bookType });
      const loaded = XLSX.read(data, { type: "array" });
      expect(readImportSheet(loaded, loaded.SheetNames[0]!)[0]?.record["SKU"]).toBe("0001");
    }
    const csv = XLSX.read('SKU;Name;CategoryID\n"0001";Bujía;encendido', {
      type: "string",
      raw: true,
    });
    expect(readImportSheet(csv, csv.SheetNames[0]!)[0]?.record["SKU"]).toBe("0001");
  });
  it("rejects Excel error cells and oversized column ranges", () => {
    const book = workbook([
      ["SKU", "Name", "CategoryID", "Price"],
      ["1", "Repuesto", "frenos", 10],
    ]);
    book.Sheets["Repuestos"]!["D2"] = { t: "e", v: 7, w: "#DIV/0!" };
    expect(() => readImportSheet(book, "Repuestos")).toThrow("error de Excel");
    book.Sheets["Repuestos"]!["!ref"] = "A1:XFD2";
    expect(() => readImportSheet(book, "Repuestos")).toThrow("256 columnas");
  });
  it("does not turn numeric formatting into a different SKU and rejects date-formatted values", () => {
    const book = workbook([
      ["SKU", "Name", "CategoryID"],
      [30907, "Repuesto", "frenos"],
    ]);
    book.Sheets["Repuestos"]!["A2"] = { t: "n", v: 30907, z: "#,##0", w: "30,907" };
    expect(readImportSheet(book, "Repuestos")[0]?.record["SKU"]).toBe("30907");
    book.Sheets["Repuestos"]!["A2"] = { t: "n", v: 45292, z: "m/d/yyyy", w: "1/1/2024" };
    expect(() => readImportSheet(book, "Repuestos")).toThrow("fecha de Excel");
    const roundtrip = XLSX.read(XLSX.write(book, { type: "array", bookType: "xlsx" }), {
      type: "array",
      cellNF: true,
      raw: true,
    });
    expect(() => readImportSheet(roundtrip, "Repuestos")).toThrow("fecha de Excel");
  });
});
