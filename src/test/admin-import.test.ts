import { describe, expect, it } from "vitest";
import { parseImportRow, validateDuplicateSkus, type CatalogLookup } from "@/lib/admin-import";

const categories: CatalogLookup[] = [
  { id: "filters-id", name: "Filtros", slug: "filtros" },
  { id: "brakes-id", name: "Frenos", slug: "frenos" },
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

describe("product Excel import validation", () => {
  it("resolves CategoryID with CategoryName regardless of column order", () => {
    const row = parseImportRow(
      { SKU: "COR-1", NAME: "Correa", CategoryID: 17, CategoryName: "Correas", ModelID: "CIVIC", YearFrom: 2019, YearTo: 2024 },
      2,
      [...categories, { id: "correas-id", name: "Correas", slug: "correas" }],
      models,
    );
    expect(row.error).toBeNull();
    expect(row.categoryId).toBe("correas-id");
    expect(row.modelId).toBe("civic-id");
  });

  it("accepts staged new categories and models without database writes during parsing", () => {
    const row = parseImportRow(
      { SKU: "FLU-1", NAME: "Fluido de transmisión", CategoryID: "FLU", CategoryName: "Fluidos", ModelID: "ZR-V", YearFrom: 2023, YearTo: 2026 },
      3,
      [...categories, { id: "pending-fluidos", name: "Fluidos", slug: "fluidos" }],
      [...models, { id: "pending-zr-v", name: "ZR-V", slug: "zr-v" }],
    );
    expect(row.error).toBeNull();
    expect(row.categoryId).toBe("pending-fluidos");
    expect(row.modelId).toBe("pending-zr-v");
  });

  it("parses localized prices and filter subcategories", () => {
    const row = parseImportRow(
      productRecord({
        "Subcategoría Filtros": "Filtros de Aceite",
        Modelo: "Civic",
        "Año Desde": 2016,
        "Año Hasta": 2021,
      }),
      2,
      categories,
      models,
    );

    expect(row.error).toBeNull();
    expect(row.price).toBe(1250.5);
    expect(row.categoryId).toBe("filters-id");
    expect(row.modelId).toBe("civic-id");
    expect(row.yearFrom).toBe(2016);
  });

  it("rejects invalid stock, availability, and model year ranges", () => {
    const row = parseImportRow(
      productRecord({
        Stock: -1,
        Disponibilidad: "disponibilidad desconocida",
        Modelo: "Civic",
        "Año Desde": 2022,
        "Año Hasta": 2020,
      }),
      3,
      categories,
      models,
    );

    expect(row.error).toContain("Stock debe ser entero y no negativo");
    expect(row.error).toContain("Disponibilidad desconocida");
    expect(row.error).toContain("Año desde no puede superar año hasta");
  });

  it("allows repeated SKUs for different models but rejects inconsistent product data", () => {
    const first = parseImportRow(
      productRecord({ Modelo: "Civic", "Año Desde": 2016, "Año Hasta": 2021 }),
      2,
      categories,
      models,
    );
    const second = parseImportRow(
      productRecord({ Modelo: "Fit", "Año Desde": 2015, "Año Hasta": 2020 }),
      3,
      categories,
      models,
    );
    const consistentRows = validateDuplicateSkus([first, second]);
    expect(consistentRows.every((row) => row.error === null)).toBe(true);

    const inconsistent = parseImportRow(
      productRecord({
        Nombre: "Otro filtro",
        Modelo: "Fit",
        "Año Desde": 2015,
        "Año Hasta": 2020,
      }),
      4,
      categories,
      models,
    );
    const inconsistentRows = validateDuplicateSkus([first, inconsistent]);
    expect(inconsistentRows.every((row) => row.error?.includes("mismos datos"))).toBe(true);
  });

  it("imports CategoryName and ModelID headers and applies the highest repeated-SKU price", () => {
    const first = parseImportRow(
      {
        SKU: "30907",
        NAME: "Filtro de Aceite",
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
      },
      2,
      categories,
      models,
    );
    const second = parseImportRow(
      {
        SKU: "30907",
        NAME: "Filtro de Aceite",
        CategoryName: "Filtros",
        HondaCode: "15400-RTA-003",
        Description: "Filtro de Aceite",
        Price: 5.17,
        Stock: 0,
        availability: 0,
        Active: "Si",
        ModelID: "Fit",
        YearFrom: 2018,
        YearTo: 2023,
      },
      3,
      categories,
      models,
    );

    const rows = validateDuplicateSkus([first, second]);

    expect(rows.every((row) => row.error === null)).toBe(true);
    expect(rows.map((row) => row.price)).toEqual([716.56, 716.56]);
    expect(rows[0]?.categoryId).toBe("filters-id");
    expect(rows[0]?.modelId).toBe("civic-id");
    expect(rows[0]?.availability).toBe("consultar");
  });
});
