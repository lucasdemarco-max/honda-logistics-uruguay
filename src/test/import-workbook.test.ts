import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  readImportWorkbook,
  validateImportFile,
} from "@/lib/import-workbook";
import { prepareImportRecords } from "@/lib/admin-import";
import { createImportTemplate } from "@/lib/import-template";

function workbookFrom(sheets: Record<string, unknown[][]>) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return book;
}

const headers = [
  "SKU",
  "NAME",
  "CategoryID",
  "CategoryName",
  "HondaCode",
  "Price",
  "Stock",
  "ModelID",
  "YearFrom",
  "YearTo",
];
const data = ["000123", "Pieza", "BRAKES", "Frenos", "00123456", 1250.5, 2, "CIVIC", 2018, 2024];

describe("universal Excel workbook reader", () => {
  it("round-trips the downloaded template after filling a product row, ignoring all reference sheets", () => {
    const categories = [
      { id: "11111111-2222-3333-4444-555555555555", slug: "frenos", name: "Frenos" },
    ];
    const models = [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", slug: "civic", name: "Civic" }];
    const template = createImportTemplate(categories, models);
    XLSX.utils.sheet_add_aoa(
      template.Sheets["Productos"]!,
      [
        [
          "000123",
          "Pastillas",
          categories[0]!.id,
          "Frenos",
          "45022-HON-001",
          "",
          1250.5,
          0,
          "consultar",
          "sí",
          models[0]!.id,
          "Civic",
          2020,
          2024,
          "Aplicación verificada",
        ],
      ],
      { origin: "A2" },
    );
    const bytes = XLSX.write(template, { type: "array", bookType: "xlsx" });
    const result = readImportWorkbook(XLSX.read(bytes, { type: "array", raw: true, cellNF: true }));
    expect(result.records).toHaveLength(1);
    expect(result.sheets).toEqual([{ name: "Productos", headerRow: 1, rowCount: 1 }]);
    expect(result.ignoredSheets).toEqual(["Instrucciones", "Categorias", "Modelos"]);
    const plan = prepareImportRecords(result.records, categories, models);
    expect(plan.rows[0]).toMatchObject({
      error: null,
      sku: "000123",
      categoryId: categories[0]!.id,
      modelId: models[0]!.id,
      stock: 0,
    });
    expect(plan.newCategories).toEqual([]);
    expect(plan.newModels).toEqual([]);
  });
  it("detects headers after titles, combines product sheets and reports auxiliary sheets", () => {
    const book = workbookFrom({
      Instrucciones: [["Cómo completar la plantilla"], ["No modifiques los códigos"]],
      Frenos: [["Catálogo Honda"], [], headers, data],
      Filtros: [
        headers,
        ["000124", "Otra pieza", "OIL", "Lubricación", "15400-RTA-003", 700, 0, "FIT", 2019, 2023],
      ],
      Modelos: [
        ["ModelID", "ModelName"],
        ["CIVIC", "Civic"],
      ],
    });
    const result = readImportWorkbook(book);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({ sheetName: "Frenos", rowNumber: 4 });
    expect(result.sheets).toEqual([
      { name: "Frenos", headerRow: 3, rowCount: 1 },
      { name: "Filtros", headerRow: 1, rowCount: 1 },
    ]);
    expect(result.ignoredSheets).toEqual(["Instrucciones", "Modelos"]);
  });

  it.each(["xlsx", "xls"] as const)(
    "preserves text and formatted numeric codes through a real %s round-trip",
    (bookType) => {
      const book = workbookFrom({ Productos: [headers, data] });
      book.Sheets["Productos"]!["A2"] = { t: "n", v: 123, z: "000000" };
      const bytes = XLSX.write(book, { type: "array", bookType });
      const read = XLSX.read(bytes, { type: "array", cellNF: true });
      const result = readImportWorkbook(read);
      expect(result.records[0]?.record["SKU"]).toBe("000123");
      expect(result.records[0]?.record["HondaCode"]).toBe("00123456");
      expect(result.records[0]?.record["Price"]).toBe(1250.5);
    },
  );

  it.each(["#,##0", "$#,##0", "0.00E+00"])(
    "does not treat numeric presentation %s as part of an identifier",
    (format) => {
      const book = workbookFrom({ Productos: [headers, data] });
      book.Sheets["Productos"]!["A2"] = { t: "n", v: 1234, z: format };
      const result = readImportWorkbook(book);
      expect(result.records[0]?.record["SKU"]).toBe("1234");
    },
  );

  it("rejects date-formatted identifiers and rows consisting entirely of uncached formulas", () => {
    const dateBook = workbookFrom({ Productos: [headers, data] });
    dateBook.Sheets["Productos"]!["A2"] = { t: "n", v: 45000, z: "m/d/yy" };
    expect(() => readImportWorkbook(dateBook)).toThrow("formato de fecha");
    const formulaBook = workbookFrom({ Productos: [headers, Array(headers.length).fill("")] });
    formulaBook.Sheets["Productos"]!["A2"] = { t: "n", f: "100+1" };
    expect(() => readImportWorkbook(formulaBook)).toThrow("recalculá");
  });

  it("reads a CSV export with leading-zero text codes when raw values are retained", () => {
    const csv =
      "SKU,NAME,CategoryID,CategoryName,HondaCode,Price,Stock\n000123,Pieza,FRE,Frenos,00123456,1250.50,2";
    const book = XLSX.read(csv, { type: "string", raw: true });
    const result = readImportWorkbook(book);
    expect(result.records[0]?.record["SKU"]).toBe("000123");
    expect(result.records[0]?.record["HondaCode"]).toBe("00123456");
    const plan = prepareImportRecords(result.records, [], []);
    expect(plan.rows[0]?.price).toBe(1250.5);
    expect(plan.rows[0]?.error).toBeNull();
  });

  it("validates repeated SKUs across sheet boundaries and preserves both applications", () => {
    const book = workbookFrom({
      Civic: [headers, data],
      Fit: [headers, [...data.slice(0, 7), "FIT", 2019, 2023]],
    });
    const result = readImportWorkbook(book);
    const plan = prepareImportRecords(result.records, [], []);
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows.every((row) => !row.error)).toBe(true);
    expect(new Set(plan.rows.map((row) => row.modelId)).size).toBe(2);
    expect(plan.newCategories).toHaveLength(1);
  });

  it("rejects alias collisions rather than silently picking a column", () => {
    expect(() =>
      readImportWorkbook(
        workbookFrom({
          Productos: [
            ["SKU", "NAME", "Nombre"],
            ["A", "B", "C"],
          ],
        }),
      ),
    ).toThrow("duplicado o ambiguo");
    expect(() =>
      readImportWorkbook(
        workbookFrom({
          Productos: [
            ["SKU", "NAME", "Precio", "Price"],
            ["A", "B", 1, 2],
          ],
        }),
      ),
    ).toThrow("duplicado o ambiguo");
  });

  it("does not silently skip an intended product sheet with missing required headers", () => {
    expect(() =>
      readImportWorkbook(
        workbookFrom({
          Filtros: [
            ["SKU", "Descripción"],
            ["123", "Filtro"],
          ],
          Frenos: [headers, data],
        }),
      ),
    ).toThrow("SKU y Nombre");
  });

  it("retains actual Excel row numbers across blank rows", () => {
    const result = readImportWorkbook(workbookFrom({ Productos: [headers, [], data] }));
    expect(result.records[0]?.rowNumber).toBe(3);
  });

  it("rejects populated columns without a header", () => {
    expect(() =>
      readImportWorkbook(
        workbookFrom({
          Productos: [
            ["SKU", "NAME", ""],
            ["A", "Pieza", "Dato"],
          ],
        }),
      ),
    ).toThrow("sin encabezado");
  });

  it("rejects Excel error cells and formulas with no cached value", () => {
    const book = workbookFrom({ Productos: [headers, data] });
    book.Sheets["Productos"]!["F2"] = { t: "e", v: 7 };
    expect(() => readImportWorkbook(book)).toThrow("error de Excel");
    book.Sheets["Productos"]!["F2"] = { t: "n", f: "1+1" };
    expect(() => readImportWorkbook(book)).toThrow("recalculá");
  });

  it("refuses unsafe numeric identifiers rather than silently losing digits", () => {
    const book = workbookFrom({ Productos: [headers, data] });
    book.Sheets["Productos"]!["A2"] = { t: "n", v: 9007199254740992 };
    expect(() => readImportWorkbook(book)).toThrow("códigos como texto");
  });

  it("bounds files, columns and total rows before an import can proceed", () => {
    expect(() => validateImportFile("catalog.xlsx", MAX_IMPORT_FILE_BYTES + 1)).toThrow("20 MB");
    expect(() => validateImportFile("catalog.pdf", 10)).toThrow(".xlsx");
    expect(() => validateImportFile("catalog.csv", 0)).toThrow("vacío");
    expect(() => validateImportFile("catalog.XLSX", 1024)).not.toThrow();
    const oversized = workbookFrom({ Productos: [headers, data] });
    oversized.Sheets["Productos"]!["!ref"] = `A1:J${MAX_IMPORT_ROWS + 51}`;
    expect(() => readImportWorkbook(oversized)).toThrow("20.000");
    oversized.Sheets["Productos"]!["!ref"] = "A1:DW2";
    expect(() => readImportWorkbook(oversized)).toThrow("100 columnas");
  });

  it("reports empty workbooks without inventing product rows", () => {
    expect(() => readImportWorkbook(workbookFrom({ Instrucciones: [["Nada cargado"]] }))).toThrow(
      "No encontramos hojas",
    );
    expect(() => readImportWorkbook(workbookFrom({ Productos: [headers] }))).toThrow(
      "no contienen filas",
    );
  });
});
