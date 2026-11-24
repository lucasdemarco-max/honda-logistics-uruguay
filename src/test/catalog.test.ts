import { describe, expect, it, vi } from "vitest";
import filtrosData from "@/data/filtros.json";
import {
  buildCatalogSnapshot,
  filterCatalog,
  readCatalogPages,
  resolveCatalogSelection,
  type CategoryRow,
  type CompatibilityRow,
  type LegacyCatalogProduct,
  type ProductRow,
  type VehicleModelRow,
} from "@/lib/catalog";

const category = (overrides: Partial<CategoryRow> = {}): CategoryRow => ({
  id: "category-filters",
  name: "Filtros",
  slug: "filtros",
  image_key: "filtros",
  description: null,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const model = (overrides: Partial<VehicleModelRow> = {}): VehicleModelRow => ({
  id: "model-civic-db",
  name: "Civic",
  slug: "civic",
  sort_order: 1,
  ...overrides,
});

const product = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: "product-db",
  sku: "PART-001",
  name: "Repuesto registrado",
  category_id: "category-filters",
  honda_code: null,
  description: null,
  brand_id: null,
  homologation_reference: null,
  honda_relation: null,
  image_url: null,
  price_uyu: null,
  stock: null,
  availability: "consultar",
  promo_text: null,
  active: true,
  is_demo: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const application = (overrides: Partial<CompatibilityRow> = {}): CompatibilityRow => ({
  id: "application-db",
  product_id: "product-db",
  model_id: "model-civic-db",
  year_from: 2012,
  year_to: 2015,
  notes: null,
  ...overrides,
});

const localProduct = (): LegacyCatalogProduct => ({
  ...product({ id: "local-product", category_id: "subcat-aceite", price_uyu: 100, stock: 3 }),
  category: {
    id: "subcat-aceite",
    name: "Filtros de Aceite",
    slug: "filtros-aceite",
    image_key: "filtros",
  },
  brand: null,
  compat: [
    {
      model: "Civic",
      model_slug: "civic",
      year_from: 2012,
      year_to: 2015,
      notes: "Aplicación verificada",
    },
  ],
});

const emptySources = () => ({
  products: [] as ProductRow[],
  compatibilities: [] as CompatibilityRow[],
  categories: [] as CategoryRow[],
  models: [] as VehicleModelRow[],
  brands: [],
  localProducts: [] as LegacyCatalogProduct[],
});

describe("catalog identity and preservation", () => {
  it("retains every existing verified SKU and application without mutating the source", () => {
    const before = JSON.stringify(filtrosData);
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      localProducts: filtrosData as LegacyCatalogProduct[],
    });

    expect(snapshot.products).toHaveLength(52);
    expect(new Set(snapshot.products.map((item) => item.sku)).size).toBe(52);
    expect(snapshot.products.reduce((count, item) => count + item.compat.length, 0)).toBe(132);
    expect(snapshot.meta.categories).toHaveLength(5);
    expect(snapshot.meta.models).toHaveLength(12);
    expect(snapshot.products.every((item) => item.compat.every((compat) => compat.model_id))).toBe(
      true,
    );
    expect(JSON.stringify(filtrosData)).toBe(before);
  });

  it("reconciles database IDs and keeps historical category/model IDs as aliases", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category({ id: "oil-db", name: "Filtros de Aceite", slug: "filtros-aceite" })],
      models: [model()],
      localProducts: [localProduct()],
    });

    expect(snapshot.meta.categories).toHaveLength(1);
    expect(snapshot.meta.categories[0]).toMatchObject({ id: "oil-db", aliases: ["subcat-aceite"] });
    expect(snapshot.products[0]?.category_id).toBe("oil-db");
    expect(snapshot.products[0]?.compat[0]?.model_id).toBe("model-civic-db");
    expect(
      resolveCatalogSelection(snapshot.meta, {
        categoryId: "subcat-aceite",
        modelId: "model-civic",
      }),
    ).toEqual({ categoryId: "oil-db", modelId: "model-civic-db" });
    expect(
      filterCatalog(snapshot, { categoryId: "subcat-aceite", modelId: "model-civic" }),
    ).toHaveLength(1);
  });

  it("uses database commercial fields once per SKU and preserves distinct applications and notes", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      models: [model(), model({ id: "fit-db", name: "Fit", slug: "fit" })],
      products: [
        product({ price_uyu: 0, stock: 0, description: "Actualizado", availability: "sin_stock" }),
      ],
      compatibilities: [
        application({ notes: "Aplicación verificada" }),
        application({
          id: "fit-application",
          model_id: "fit-db",
          year_from: 2018,
          year_to: 2022,
          notes: "Otra aplicación",
        }),
      ],
      localProducts: [localProduct()],
    });

    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0]).toMatchObject({
      id: "product-db",
      price_uyu: 0,
      stock: 0,
      description: "Actualizado",
      availability: "sin_stock",
    });
    expect(snapshot.products[0]?.compat).toHaveLength(2);
    expect(snapshot.products[0]?.compat.map((item) => item.notes)).toEqual([
      "Aplicación verificada",
      "Otra aplicación",
    ]);
  });

  it("keeps demo products and exposes newly imported categories without a hardcoded list", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [
        category(),
        category({ id: "new-system", name: "Refrigeración", slug: "refrigeracion" }),
        category({ id: "empty-category", slug: "empty", name: "Sin productos" }),
      ],
      models: [model(), model({ id: "unused-model", slug: "unused", name: "Sin aplicaciones" })],
      products: [
        product({ sku: "DEMO-FIL-001", is_demo: true }),
        product({ id: "new-product", sku: "NEW-001", category_id: "new-system" }),
      ],
      compatibilities: [
        application(),
        application({ id: "new-application", product_id: "new-product" }),
      ],
    });

    expect(snapshot.products.find((item) => item.sku === "DEMO-FIL-001")?.is_demo).toBe(true);
    expect(snapshot.meta.categories.map((item) => item.id)).toEqual([
      "category-filters",
      "new-system",
    ]);
    expect(snapshot.meta.models.map((item) => item.id)).toEqual(["model-civic-db"]);
    expect(
      filterCatalog(snapshot, { categoryId: "new-system", modelId: "model-civic-db" }).map(
        (item) => item.sku,
      ),
    ).toEqual(["NEW-001"]);
  });

  it("does not fabricate compatibility for products without applications", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      products: [product()],
    });
    expect(snapshot.meta.models).toEqual([]);
    expect(snapshot.meta.facets).toEqual([
      {
        productId: "product-db",
        categoryId: "category-filters",
        modelId: null,
        yearFrom: null,
        yearTo: null,
      },
    ]);
    expect(filterCatalog(snapshot, { modelId: "model-civic-db" })).toEqual([]);
    expect(filterCatalog(snapshot, { anio: 2020 })).toEqual([]);
    expect(filterCatalog(snapshot, {})).toHaveLength(1);
  });

  it("excludes inactive records and their otherwise unused facets", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      models: [model()],
      products: [product({ active: false })],
      compatibilities: [application()],
    });
    expect(snapshot.products).toEqual([]);
    expect(snapshot.meta.facets).toEqual([]);
    expect(snapshot.meta.categories).toEqual([]);
    expect(snapshot.meta.models).toEqual([]);
  });
});

describe("catalog filtering", () => {
  it("applies model and year to the same application", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      models: [model(), model({ id: "fit-db", name: "Fit", slug: "fit" })],
      products: [product()],
      compatibilities: [
        application(),
        application({ id: "fit-application", model_id: "fit-db", year_from: 2020, year_to: 2022 }),
      ],
    });
    expect(filterCatalog(snapshot, { modelId: "model-civic-db", anio: 2020 })).toEqual([]);
    expect(filterCatalog(snapshot, { modelId: "fit-db", anio: 2020 })).toHaveLength(1);
    expect(filterCatalog(snapshot, { modelo: "CIVIC", anio: 2012 })).toHaveLength(1);
    expect(filterCatalog(snapshot, { modelId: "unknown" })).toEqual([]);
    expect(filterCatalog(snapshot, { categoryId: "unknown" })).toEqual([]);
  });

  it("retains legacy Filtros links while including database imports", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      models: [model()],
      products: [product({ sku: "IMPORTED-FILTER" })],
      compatibilities: [application()],
      localProducts: [localProduct()],
    });
    expect(filterCatalog(snapshot, { categoria: "filtros" })).toHaveLength(2);
    expect(
      filterCatalog(snapshot, { categoria: "filtros", modelo: "civic", anio: 2014 }),
    ).toHaveLength(2);
    expect(
      filterCatalog(snapshot, { categoryId: "category-filters" }).map((item) => item.sku),
    ).toEqual(["IMPORTED-FILTER"]);
    expect(
      filterCatalog(snapshot, { categoria: "filtros-aceite" }).map((item) => item.sku),
    ).toEqual(["PART-001"]);
  });

  it("searches codes, descriptions and model names with accent-insensitive text", () => {
    const snapshot = buildCatalogSnapshot({
      ...emptySources(),
      categories: [category()],
      models: [model()],
      products: [product({ honda_code: "15400-RTA-003", description: "Lubricación" })],
      compatibilities: [application()],
    });
    expect(filterCatalog(snapshot, { q: "15400-rta" })).toHaveLength(1);
    expect(filterCatalog(snapshot, { q: "lubricacion" })).toHaveLength(1);
    expect(filterCatalog(snapshot, { q: "civic" })).toHaveLength(1);
    expect(filterCatalog(snapshot, { q: "no existe" })).toHaveLength(0);
  });
});

describe("complete catalog reads", () => {
  it("reads beyond the old 200-row RPC and a single Supabase page", async () => {
    const records = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number, to: number) => ({
      data: records.slice(from, to + 1),
      error: null,
    }));
    expect(await readCatalogPages("los productos", read)).toEqual(records);
    expect(read.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  it("fails explicitly instead of presenting a partial catalog as complete", async () => {
    const read = vi.fn(async (from: number) =>
      from === 0
        ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
        : { data: null, error: new Error("Backend unavailable") },
    );
    await expect(readCatalogPages("los productos", read)).rejects.toThrow(
      "No pudimos cargar los productos",
    );
  });
});
