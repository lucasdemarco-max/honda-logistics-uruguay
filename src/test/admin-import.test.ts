import { describe, expect, it } from "vitest";
import {
  parseImportRow,
  validateDuplicateSkus,
  prepareImport,
  buildProductPatch,
  parseImportNumber,
  type CatalogLookup,
} from "@/lib/admin-import";

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
    expect(row.categoryId).toBe("new:filtros-de-aceite");
    expect(row.category?.isNew).toBe(true);
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

describe("universal ID-based import", () => {
  it("resolves real IDs before names and preserves punctuation in external identifiers", () => {
    const row = parseImportRow(
      {
        SKU: "000031",
        Name: "Pastilla",
        CategoryID: "brakes-id",
        CategoryName: "Frenos",
        ModelID: "civic-id",
        ModelName: "Civic",
        YearFrom: 2020,
        YearTo: 2024,
      },
      2,
      categories,
      models,
    );
    expect(row.error).toBeNull();
    expect(row.categoryId).toBe("brakes-id");
    expect(row.modelId).toBe("civic-id");
    expect(row.sku).toBe("000031");
    const preview = prepareImport(
      [
        {
          rowNumber: 2,
          record: {
            SKU: "S1",
            Name: "Repuesto",
            CategoryID: "cat_1",
            CategoryName: "Sensores",
            ModelID: "PLAT-1",
            ModelName: "Plataforma uno",
            YearFrom: 2010,
            YearTo: 2012,
          },
        },
      ],
      categories,
      models,
    );
    expect(preview.rows[0]?.error).toBeNull();
    expect(preview.newCategories[0]?.slug).toBe("cat_1");
    expect(preview.newModels[0]?.slug).toBe("plat-1");
  });

  it("rejects conflicting IDs/names and unknown UUIDs rather than replacing known records", () => {
    expect(
      parseImportRow(productRecord({ CategoryID: "brakes-id" }), 2, categories, models).error,
    ).toContain("ID y el nombre no coinciden");
    expect(
      parseImportRow(
        { SKU: "1", Name: "Repuesto", CategoryID: "00000000-0000-4000-8000-000000000001" },
        2,
        categories,
        models,
      ).error,
    ).toContain("UUID desconocido");
    const preview = prepareImport(
      [
        {
          rowNumber: 2,
          record: { SKU: "1", Name: "Uno", CategoryID: "c1", CategoryName: "Nueva" },
        },
        {
          rowNumber: 3,
          record: { SKU: "2", Name: "Dos", CategoryID: "c2", CategoryName: "Nueva" },
        },
      ],
      categories,
      models,
    );
    expect(preview.rows.every((row) => row.error?.includes("contradictorios"))).toBe(true);
  });

  it("keeps blank optional values out of product updates while preserving explicit zero and false", () => {
    const blank = parseImportRow(
      {
        SKU: "S1",
        Name: "Repuesto",
        CategoryID: "brakes-id",
        Price: "",
        Stock: "",
        Active: "",
        Description: "",
        HondaCode: "",
      },
      2,
      categories,
      models,
    );
    expect(buildProductPatch(blank)).toEqual({
      sku: "S1",
      name: "Repuesto",
      category_id: "brakes-id",
    });
    const zero = parseImportRow(
      { SKU: "S1", Name: "Repuesto", CategoryID: "brakes-id", Price: 0, Stock: 0, Active: false },
      2,
      categories,
      models,
    );
    expect(buildProductPatch(zero)).toMatchObject({ price_uyu: 0, stock: 0, active: false });
  });

  it("combines nonblank duplicate fields without clearing them and rejects contradictory notes", () => {
    const preview = prepareImport(
      [
        {
          rowNumber: 2,
          record: {
            SKU: "S1",
            Name: "Repuesto",
            CategoryID: "brakes-id",
            Price: 10,
            Stock: 0,
            ModelID: "civic-id",
            YearFrom: 2020,
            YearTo: 2024,
            CompatibilityNotes: "Aplicación A",
          },
        },
        {
          rowNumber: 3,
          record: {
            SKU: "S1",
            Name: "Repuesto",
            CategoryID: "brakes-id",
            Price: "",
            Stock: "",
            ModelID: "fit-id",
            YearFrom: 2018,
            YearTo: 2023,
          },
        },
      ],
      categories,
      models,
    );
    expect(
      preview.rows.every((row) => row.error === null && row.price === 10 && row.stock === 0),
    ).toBe(true);
    const conflict = validateDuplicateSkus([
      preview.rows[0]!,
      { ...preview.rows[0]!, compatibilityNotes: "Aplicación B" },
    ]);
    expect(conflict.every((row) => row.error?.includes("notas contradictorias"))).toBe(true);
  });

  it("rejects malformed numbers, fractional stock, unsafe codes, missing years and duplicate aliases", () => {
    for (const value of ["precio 125", "1.2.3,45", "12 34", "USD 120", "--2", "NaN"])
      expect(parseImportNumber(value)).toBeNull();
    expect(parseImportNumber("UYU 1.250,50")).toBe(1250.5);
    const row = parseImportRow(
      {
        SKU: 9007199254740992,
        Name: "Uno",
        CategoryID: "brakes-id",
        ModelID: "civic-id",
        Stock: 0.5,
      },
      2,
      categories,
      models,
    );
    expect(row.error).toContain("precisión");
    expect(row.error).toContain("Modelo requiere");
    expect(row.error).toContain("Stock debe ser entero");
    expect(
      parseImportRow(
        { SKU: "1", Nombre: "Uno", Name: "Dos", CategoryID: "brakes-id" },
        2,
        categories,
        models,
      ).error,
    ).toContain("Encabezados duplicados");
  });
});
