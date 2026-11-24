import { describe, expect, it } from "vitest";
import {
  parseImportNumber,
  parseImportRow,
  prepareImportRecords,
  validateDuplicateSkus,
  type CatalogLookup,
} from "@/lib/admin-import";

const categories: CatalogLookup[] = [
  { id: "filters-id", name: "Filtros", slug: "filtros" },
  { id: "brakes-id", name: "Frenos", slug: "frenos" },
  { id: "oil-id", name: "Filtros de Aceite", slug: "filtros-aceite" },
];
const models: CatalogLookup[] = [
  { id: "civic-id", name: "Civic", slug: "civic" },
  { id: "fit-id", name: "Fit", slug: "fit" },
];
const productRecord = (overrides: Record<string, unknown> = {}) => ({
  SKU: "HONDA-FIL-001",
  Nombre: "Filtro de aceite",
  Categoría: "Filtros",
  "Precio UYU": "1.250,50",
  Stock: 4,
  Disponibilidad: "En stock",
  Activo: "Sí",
  ...overrides,
});
const appRecord = (model: string, overrides: Record<string, unknown> = {}) =>
  productRecord({ Modelo: model, "Año Desde": 2016, "Año Hasta": 2021, ...overrides });

function parse(record: Record<string, unknown>, row = 2) {
  return parseImportRow(record, row, categories, models);
}

describe("universal product import validation", () => {
  it("preserves explicitly supplied legacy subcategories instead of collapsing them to Filtros", () => {
    const row = parse(appRecord("Civic", { "Subcategoría Filtros": "Filtros de Aceite" }));
    expect(row.error).toBeNull();
    expect(row.price).toBe(1250.5);
    expect(row.categoryId).toBe("oil-id");
    expect(row.modelId).toBe("civic-id");
    expect(row.yearFrom).toBe(2016);
  });

  it("rejects invalid stock, availability and reversed model year ranges", () => {
    const row = parse(
      appRecord("Civic", {
        Stock: -1,
        Disponibilidad: "desconocida",
        "Año Desde": 2022,
        "Año Hasta": 2020,
      }),
      3,
    );
    expect(row.error).toContain("Stock debe ser entero y no negativo");
    expect(row.error).toContain("Disponibilidad desconocida");
    expect(row.error).toContain("Año desde no puede superar año hasta");
  });

  it("allows one SKU across multiple models but blocks inconsistent product values", () => {
    const first = parse(appRecord("Civic"));
    const second = parse(appRecord("Fit"), 3);
    expect(validateDuplicateSkus([first, second]).every((row) => row.error === null)).toBe(true);
    const inconsistent = parse(appRecord("Fit", { Nombre: "Otro filtro" }), 4);
    expect(
      validateDuplicateSkus([first, inconsistent]).every((row) =>
        row.error?.includes("mismos datos"),
      ),
    ).toBe(true);
  });

  it("recognizes universal fields, resolves codes and warns before using the highest repeated price", () => {
    const record = {
      SKU: "30907",
      NAME: "Filtro de Aceite",
      CategoryID: "filtros",
      CategoryName: "Filtros",
      HondaCode: "15400-RTA-003",
      Description: "Filtro de Aceite",
      Price: 716.56,
      Stock: 0,
      availability: 0,
      Active: "Si",
      ModelID: "CIVIC",
      YearFrom: 2018,
      YearTo: 2024,
    };
    const first = parse(record);
    const second = parse({ ...record, Price: 5.17, ModelID: "Fit", YearTo: 2023 }, 3);
    const rows = validateDuplicateSkus([first, second]);
    expect(rows.every((row) => row.error === null)).toBe(true);
    expect(rows.map((row) => row.price)).toEqual([716.56, 716.56]);
    expect(rows[0]?.modelId).toBe("civic-id");
    expect(rows[0]?.availability).toBe("consultar");
    expect(rows[0]?.warnings[0]).toContain("precio mayor");
  });

  it("resolves actual IDs before slugs, while keeping CategoryID and CategoryName distinct", () => {
    const row = parseImportRow(
      {
        SKU: "A",
        NAME: "Pastilla",
        CategoryID: "brakes-id",
        CategoryName: "Frenos",
        ModelID: "civic-id",
        ModelName: "Civic",
        YearFrom: 2020,
        YearTo: 2022,
      },
      2,
      [...categories, { id: "another-id", slug: "brakes-id", name: "Otra" }],
      models,
    );
    expect(row.error).toBeNull();
    expect(row.categoryId).toBe("brakes-id");
    expect(row.modelId).toBe("civic-id");
  });

  it("rejects an ID/name contradiction instead of overwriting an existing master", () => {
    const plan = prepareImportRecords(
      [
        {
          rowNumber: 2,
          record: { SKU: "A", NAME: "Pieza", CategoryID: "brakes-id", CategoryName: "Filtros" },
        },
      ],
      categories,
      models,
    );
    expect(plan.rows[0]?.error).toContain("CategoryID y CategoryName");
    expect(plan.newCategories).toEqual([]);
  });

  it("does not recreate missing UUIDs or silently remap unfamiliar codes to existing names", () => {
    const plan = prepareImportRecords(
      [
        {
          rowNumber: 2,
          record: {
            SKU: "A",
            NAME: "Pieza",
            CategoryID: "11111111-2222-3333-4444-555555555555",
            CategoryName: "Nueva",
          },
        },
        {
          rowNumber: 3,
          record: { SKU: "B", NAME: "Pieza", CategoryID: "OTHER-CODE", CategoryName: "Filtros" },
        },
      ],
      categories,
      models,
    );
    expect(plan.rows.every((row) => row.error)).toBe(true);
    expect(plan.newCategories).toEqual([]);
    expect(plan.rows[1]?.error).toContain("no coincide");
  });

  it("plans new categories and models without modifying input lookup arrays", () => {
    const savedCategories = structuredClone(categories);
    const savedModels = structuredClone(models);
    const plan = prepareImportRecords(
      [
        {
          rowNumber: 2,
          sheetName: "Frenos",
          record: {
            SKU: "001",
            NAME: "Disco",
            CategoryID: "BRK-01",
            CategoryName: "Discos delanteros",
            ModelID: "ZR-V",
            YearFrom: 2025,
            YearTo: 2027,
          },
        },
      ],
      categories,
      models,
    );
    expect(plan.rows[0]?.error).toBeNull();
    expect(plan.rows[0]?.categoryId).toBe("pending-category:brk-01");
    expect(plan.rows[0]?.modelId).toBe("pending-model:zr-v");
    expect(plan.newCategories).toEqual([
      { id: "pending-category:brk-01", slug: "brk-01", name: "Discos delanteros" },
    ]);
    expect(plan.rows[0]?.sheetName).toBe("Frenos");
    expect(categories).toEqual(savedCategories);
    expect(models).toEqual(savedModels);
  });

  it("requires a name for a new CategoryID and never infers category from product text", () => {
    const plan = prepareImportRecords(
      [{ rowNumber: 2, record: { SKU: "A", NAME: "Filtro de aceite", CategoryID: "OIL-NEW" } }],
      categories,
      models,
    );
    expect(plan.rows[0]?.error).toContain("requiere CategoryName");
    expect(plan.newCategories).toEqual([]);
    expect(parse({ SKU: "B", NAME: "Filtro de aire" }).error).toContain("Categoría requerida");
    expect(parse({ SKU: "C", NAME: "Filtro de aceite", CategoryID: "brakes-id" }).categoryId).toBe(
      "brakes-id",
    );
  });

  it("can resolve a category name declared later in the workbook", () => {
    const plan = prepareImportRecords(
      [
        { rowNumber: 2, record: { SKU: "A", NAME: "Disco A", CategoryID: "DISC" } },
        {
          rowNumber: 3,
          record: { SKU: "B", NAME: "Disco B", CategoryID: "DISC", CategoryName: "Discos" },
        },
      ],
      categories,
      models,
    );
    expect(plan.rows.every((row) => !row.error)).toBe(true);
    expect(plan.newCategories).toHaveLength(1);
  });

  it("resolves a model name declared later before using a code-only fallback", () => {
    const plan = prepareImportRecords(
      [
        {
          rowNumber: 2,
          record: {
            SKU: "A",
            NAME: "Pieza A",
            CategoryID: "brakes-id",
            ModelID: "NEW",
            YearFrom: 2020,
            YearTo: 2024,
          },
        },
        {
          rowNumber: 3,
          record: {
            SKU: "B",
            NAME: "Pieza B",
            CategoryID: "brakes-id",
            ModelID: "NEW",
            ModelName: "Modelo nuevo",
            YearFrom: 2020,
            YearTo: 2024,
          },
        },
      ],
      categories,
      models,
    );
    expect(plan.rows.every((row) => !row.error)).toBe(true);
    expect(plan.newModels).toEqual([
      { id: "pending-model:new", slug: "new", name: "Modelo nuevo" },
    ]);
  });

  it("validates a full-size repeated-SKU workbook without repeatedly scanning the same group", () => {
    const first = parse(appRecord("Civic"));
    const rows = Array.from({ length: 20_000 }, (_, index) => ({ ...first, rowNumber: index + 2 }));
    const result = validateDuplicateSkus(rows);
    expect(result).toHaveLength(20_000);
    expect(result.every((row) => !row.error && row.stock === 4)).toBe(true);
  }, 2000);

  it("keeps punctuation significant in external codes", () => {
    const plan = prepareImportRecords(
      [
        {
          rowNumber: 2,
          record: { SKU: "A", NAME: "Pieza A", CategoryID: "BRK_01", CategoryName: "Discos" },
        },
        {
          rowNumber: 3,
          record: { SKU: "B", NAME: "Pieza B", CategoryID: "BRK-01", CategoryName: "Pastillas" },
        },
      ],
      categories,
      models,
    );
    expect(plan.newCategories.map((item) => item.slug)).toEqual(["brk_01", "brk-01"]);
    expect(plan.rows.every((row) => !row.error)).toBe(true);
  });

  it("preserves omitted/blank optional values but recognizes explicit zero and false", () => {
    const blank = parse({
      SKU: "A",
      NAME: "Pieza",
      CategoryID: "brakes-id",
      Price: "",
      Stock: "",
      Active: "",
      Description: "",
    });
    expect(blank.error).toBeNull();
    expect(Object.values(blank.provided).every((value) => value === false)).toBe(true);
    const explicit = parse({
      SKU: "A",
      NAME: "Pieza",
      CategoryID: "brakes-id",
      Price: 0,
      Stock: 0,
      Active: false,
      Availability: "consultar",
    });
    expect(explicit.price).toBe(0);
    expect(explicit.stock).toBe(0);
    expect(explicit.active).toBe(false);
    expect(explicit.provided).toMatchObject({
      price: true,
      stock: true,
      active: true,
      availability: true,
    });
  });

  it("merges nonempty duplicate optional cells without clearing values or summing stock", () => {
    const first = parse(appRecord("Civic", { Stock: "", "Código Honda": "", Descripción: "" }));
    const second = parse(
      appRecord("Fit", { "Código Honda": "15400-X", Descripción: "Descripción explícita" }),
    );
    const merged = validateDuplicateSkus([first, second]);
    expect(merged.every((row) => !row.error)).toBe(true);
    expect(merged.map((row) => row.stock)).toEqual([4, 4]);
    expect(merged.map((row) => row.hondaCode)).toEqual(["15400-X", "15400-X"]);
    expect(merged[0]?.provided.stock).toBe(true);
  });

  it("rejects contradictory notes for an identical application and records sheet names in errors", () => {
    const first = parseImportRow(
      appRecord("Civic", { Notas: "Motor A" }),
      2,
      categories,
      models,
      "Hoja A",
    );
    const second = parseImportRow(
      appRecord("Civic", { Notas: "Motor B" }),
      7,
      categories,
      models,
      "Hoja B",
    );
    const rows = validateDuplicateSkus([first, second]);
    expect(rows[0]?.error).toContain("notas contradictorias");
    expect(rows[1]?.error).toContain("Hoja B · Fila 7");
  });

  it("requires explicit complete years for an application and rejects orphan years/notes", () => {
    expect(
      parse({
        SKU: "A",
        NAME: "Pieza",
        CategoryID: "brakes-id",
        ModelID: "civic-id",
        YearFrom: 2020,
      }).error,
    ).toContain("año desde y año hasta");
    expect(
      parse({ SKU: "A", NAME: "Pieza", CategoryID: "brakes-id", YearFrom: 2020, YearTo: 2024 })
        .error,
    ).toContain("Ingresá un modelo");
    expect(
      parse({ SKU: "A", NAME: "Pieza", CategoryID: "brakes-id", CompatibilityNotes: "Motor X" })
        .error,
    ).toContain("notas de compatibilidad");
  });

  it("blocks unknown active values, fractional/oversized stock, price precision and invalid years", () => {
    expect(parse(productRecord({ Activo: "quizás" })).error).toContain("Activo debe ser sí/no");
    expect(parse(productRecord({ Stock: 2.5 })).error).toContain("Stock debe ser entero");
    expect(parse(productRecord({ Stock: 2147483648 })).error).toContain("Stock debe ser entero");
    expect(parse(productRecord({ "Precio UYU": 1.234 })).error).toContain("2 decimales");
    expect(parse(appRecord("Civic", { "Año Desde": 1969 })).error).toContain("1970 y 2100");
    expect(parse(appRecord("Civic", { "Año Hasta": 2023.5 })).error).toContain(
      "años deben ser enteros",
    );
  });

  it("rejects duplicate aliases in direct records", () => {
    expect(parse({ ...productRecord(), NAME: "Otro nombre" }).error).toContain(
      "Columnas duplicadas",
    );
  });
});

describe("strict localized numeric parsing", () => {
  it.each([
    ["1.250,50", 1250.5],
    ["1,250.50", 1250.5],
    ["$ 1.250,50", 1250.5],
    ["UYU 1 250,50", 1250.5],
    ["1250.50", 1250.5],
    ["1.250", 1250],
    [0, 0],
    ["0", 0],
  ])("parses %s", (input, expected) => expect(parseImportNumber(input)).toBe(expected));
  it.each([
    "abc123",
    "USD 12",
    "1..2",
    "12,34,56",
    "12.34,56",
    "1 2",
    "=1+2",
    "NaN",
    Infinity,
    true,
  ])("rejects %s", (input) => expect(parseImportNumber(input)).toBeNull());
});
