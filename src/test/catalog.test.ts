import { describe, expect, it } from "vitest";
import bundledProducts from "@/data/filtros.json";
import {
  buildCatalogSnapshot,
  filterCatalogProducts,
  findCatalogLookup,
  validateCatalogQuery,
  type CatalogProduct,
  type CatalogSourceProduct,
  type Category,
  type VehicleModel,
} from "@/lib/catalog";

const categories: Category[] = [
  {
    id: "cat-filters",
    name: "Filtros",
    slug: "filtros",
    sort_order: 0,
    image_key: "filtros",
    description: null,
    created_at: "2026-01-01",
  },
  {
    id: "cat-oil",
    name: "Filtros de Aceite",
    slug: "filtros-aceite",
    sort_order: 1,
    image_key: "filtros",
    description: null,
    created_at: "2026-01-01",
  },
  {
    id: "cat-brakes",
    name: "Frenos",
    slug: "frenos",
    sort_order: 2,
    image_key: "frenos",
    description: null,
    created_at: "2026-01-01",
  },
];
const models: VehicleModel[] = [
  { id: "civic-db", name: "Civic", slug: "civic", sort_order: 1 },
  { id: "fit-db", name: "Fit", slug: "fit", sort_order: 2 },
];
function product(patch: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "db-product",
    sku: "BRAKE-001",
    name: "Pastilla de freno",
    honda_code: "45022-TBA-A01",
    category_id: "cat-brakes",
    category: categories[2]!,
    brand_id: null,
    brand: null,
    description: null,
    homologation_reference: null,
    honda_relation: null,
    price_uyu: 1000,
    stock: 4,
    availability: "en_stock",
    active: true,
    is_demo: false,
    image_url: null,
    promo_text: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    compat: [
      {
        model_id: "civic-db",
        model: "Civic",
        model_slug: "civic",
        year_from: 2010,
        year_to: 2015,
        notes: null,
      },
    ],
    ...patch,
  };
}
const local = bundledProducts as CatalogSourceProduct[];

describe("catalogue identity and conservation", () => {
  it("keeps every bundled SKU and adds unrelated database products without mutating the source", () => {
    const before = JSON.stringify(local);
    const snapshot = buildCatalogSnapshot(local, [product()], categories, models);
    expect(snapshot.products).toHaveLength(local.length + 1);
    expect(new Set(snapshot.products.map((item) => item.sku)).size).toBe(local.length + 1);
    for (const original of local)
      expect(snapshot.products.some((item) => item.sku === original.sku)).toBe(true);
    expect(JSON.stringify(local)).toBe(before);
    expect(snapshot.meta.categories.some((item) => item.slug === "filtros-combustible")).toBe(true);
    expect(snapshot.meta.models.some((item) => item.slug === "ridgeline")).toBe(true);
    expect(snapshot.meta.models.filter((item) => item.slug === "civic")).toHaveLength(1);
  });

  it("uses the real database ID and values for a shared SKU, retaining existing applications", () => {
    const original = local[0]!;
    const remote = product({
      sku: original.sku,
      price_uyu: 0,
      stock: 0,
      availability: "sin_stock",
    });
    const snapshot = buildCatalogSnapshot([original], [remote], categories, models);
    expect(snapshot.products).toHaveLength(1);
    const result = snapshot.products[0]!;
    expect(result.id).toBe("db-product");
    expect(result.price_uyu).toBe(0);
    expect(result.stock).toBe(0);
    expect(result.category_id).toBe("cat-brakes");
    expect(result.compat.length).toBe(original.compat.length + 1);
    expect(result.compat.every((item) => Boolean(item.model_id))).toBe(true);
  });

  it("does not resurrect a local SKU deactivated in the database", () => {
    const original = local[0]!;
    expect(
      buildCatalogSnapshot([original], [], categories, models, [], [original.sku]).products,
    ).toEqual([]);
    expect(
      buildCatalogSnapshot(
        [original],
        [product({ sku: original.sku, active: false })],
        categories,
        models,
      ).products,
    ).toEqual([]);
  });

  it("does not duplicate an application when DB only adds its missing note", () => {
    const initial = product();
    const updated = product({ compat: [{ ...initial.compat[0]!, notes: "Confirmar versión" }] });
    const result = buildCatalogSnapshot([initial], [updated], categories, models).products[0]!;
    expect(result.compat).toHaveLength(1);
    expect(result.compat[0]!.notes).toBe("Confirmar versión");
  });

  it("keeps explicit dynamic categories regardless of the product name", () => {
    const supplied = {
      ...local[0]!,
      name: "Filtro de aceite",
      category_id: "cat-special",
      category: {
        id: "cat-special",
        slug: "servicio-especial",
        name: "Servicio especial",
        image_key: null,
      },
    };
    const snapshot = buildCatalogSnapshot([supplied], [], [], []);
    expect(snapshot.products[0]!.category_id).toBe("cat-special");
    expect(snapshot.meta.categories.map((item) => item.name)).toEqual(["Servicio especial"]);
    expect(snapshot.meta.modelCategories.every((item) => item.categoryId === "cat-special")).toBe(
      true,
    );
  });

  it("unifies legacy categories by unique name and retains the previous IDs/slugs as links", () => {
    const migrated = [{ ...categories[1]!, id: "new-db-oil", slug: "filtros-de-aceite" }];
    const snapshot = buildCatalogSnapshot([local[0]!], [], migrated, models);
    expect(snapshot.meta.categories).toHaveLength(1);
    expect(snapshot.products[0]!.category_id).toBe("new-db-oil");
    for (const CategoryID of ["subcat-aceite", "filtros-aceite", "new-db-oil"]) {
      expect(filterCatalogProducts(snapshot, { CategoryID })).toHaveLength(1);
    }
    expect(filterCatalogProducts(snapshot, { categoria: "filtros" })).toHaveLength(1);
    expect(migrated[0]!.aliases).toBeUndefined();
  });

  it("keeps a local model link valid after the same model receives a database UUID", () => {
    const snapshot = buildCatalogSnapshot([local[0]!], [], categories, models);
    expect(findCatalogLookup(snapshot.meta.models, "model-civic")?.id).toBe("civic-db");
    expect(filterCatalogProducts(snapshot, { modelId: "model-civic" })).toEqual(
      filterCatalogProducts(snapshot, { modelId: "civic-db" }),
    );
  });

  it("counts a product once per model/category even with several year ranges", () => {
    const remote = product();
    remote.compat.push({ ...remote.compat[0]!, year_from: 2016, year_to: 2020 });
    const snapshot = buildCatalogSnapshot([], [remote], categories, models);
    expect(snapshot.meta.modelCategories).toEqual([
      { modelId: "civic-db", categoryId: "cat-brakes", count: 1 },
    ]);
    expect(snapshot.meta.facets).toHaveLength(2);
  });
});

describe("catalogue queries", () => {
  const remote = product();
  remote.compat.push({
    model_id: "fit-db",
    model: "Fit",
    model_slug: "fit",
    year_from: 2020,
    year_to: 2025,
    notes: null,
  });
  const snapshot = buildCatalogSnapshot(local, [remote], categories, models);

  it("accepts ID-based navigation and preserves old slug links", () => {
    for (const query of [
      { ModelID: "civic-db", CategoryID: "cat-brakes" },
      { modelId: "civic-db", categoryId: "cat-brakes" },
      { modelo: "civic", categoria: "frenos" },
      { ModelID: "CIVIC", CategoryID: "FRENOS" },
    ])
      expect(filterCatalogProducts(snapshot, query).map((item) => item.sku)).toEqual(["BRAKE-001"]);
  });

  it("checks the year against the selected model's application", () => {
    expect(
      filterCatalogProducts(snapshot, {
        modelId: "civic-db",
        categoryId: "cat-brakes",
        anio: 2023,
      }),
    ).toEqual([]);
    expect(
      filterCatalogProducts(snapshot, { modelId: "fit-db", categoryId: "cat-brakes", anio: 2023 }),
    ).toHaveLength(1);
    expect(
      filterCatalogProducts(snapshot, {
        modelId: "civic-db",
        categoryId: "cat-brakes",
        anio: 2010,
      }),
    ).toHaveLength(1);
  });

  it("includes imported database filters as well as all bundled filters on legacy links", () => {
    const filter = product({
      sku: "NEW-FILTER",
      category_id: "cat-filters",
      category: categories[0]!,
    });
    const combined = buildCatalogSnapshot(local, [filter, remote], categories, models);
    const results = filterCatalogProducts(combined, { categoria: "filtros" });
    expect(results).toHaveLength(local.length + 1);
    expect(results.some((item) => item.sku === "NEW-FILTER")).toBe(true);
    expect(results.some((item) => item.sku === "BRAKE-001")).toBe(false);
  });

  it("does not broaden an unknown ID to the whole catalogue", () => {
    expect(filterCatalogProducts(snapshot, { modelId: "unknown" })).toEqual([]);
    expect(filterCatalogProducts(snapshot, { categoryId: "unknown" })).toEqual([]);
    expect(filterCatalogProducts(snapshot, { modelId: "civicdb" })).toEqual([]);
  });

  it("supports secondary code search and combined model/name text", () => {
    expect(filterCatalogProducts(snapshot, { q: "45022TBAA01" }).map((item) => item.sku)).toEqual([
      "BRAKE-001",
    ]);
    expect(filterCatalogProducts(snapshot, { q: "freno Civic" }).map((item) => item.sku)).toEqual([
      "BRAKE-001",
    ]);
    expect(
      filterCatalogProducts(snapshot, {
        q: "freno",
        modelId: "civic-db",
        categoryId: "cat-brakes",
      }),
    ).toHaveLength(1);
  });

  it("keeps demo products but places real products first", () => {
    const demo = product({ id: "demo", sku: "DEMO-FIL-001", is_demo: true, name: "A demo" });
    const combined = buildCatalogSnapshot([], [demo, remote], categories, models);
    expect(filterCatalogProducts(combined, {}).map((item) => item.sku)).toEqual([
      "BRAKE-001",
      "DEMO-FIL-001",
    ]);
  });

  it("resolves exact IDs, then slugs, then unique names", () => {
    const lookups = [
      { id: "a", slug: "civic", name: "Civic" },
      { id: "b", slug: "other", name: "civic" },
    ];
    expect(findCatalogLookup(lookups, "civic")?.id).toBe("a");
    expect(findCatalogLookup(lookups, "b")?.slug).toBe("other");
  });

  it("validates API inputs and keeps year boundaries consistent", () => {
    expect(
      validateCatalogQuery({ modelId: " civic-db ", categoryId: "cat-brakes", anio: 1970 }),
    ).toMatchObject({ ModelID: "civic-db", CategoryID: "cat-brakes", anio: 1970 });
    expect(validateCatalogQuery({ anio: 2020.5 }).anio).toBeUndefined();
    expect(validateCatalogQuery({ q: "x".repeat(100) }).q).toHaveLength(80);
    expect(validateCatalogQuery({ anio: 2100 }).anio).toBe(2100);
  });
});
