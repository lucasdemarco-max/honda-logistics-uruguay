import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bundledCatalog from "@/data/filtros.json";
import { prepareImportRecords, type CatalogLookup, type ImportRecord } from "@/lib/admin-import";
import {
  applyImportSafety,
  CatalogImportError,
  compatibilityId,
  executeCatalogImport,
  productWriteFromRow,
  type CatalogImportStore,
  type Compatibility,
  type CompatibilityWrite,
  type ImportLookups,
  type ImportProgress,
  type ProductWrite,
} from "@/lib/catalog-import";
import type { ProductRow } from "@/lib/catalog";

const categories: CatalogLookup[] = [
  { id: "category-filters", name: "Filtros", slug: "filtros" },
  { id: "category-brakes", name: "Frenos", slug: "frenos" },
];
const models: CatalogLookup[] = [
  { id: "model-civic", name: "Civic", slug: "civic" },
  { id: "model-fit", name: "Fit", slug: "fit" },
];

const makeProduct = (sku: string, overrides: Partial<ProductRow> = {}): ProductRow => ({
  id: `product-${sku}`,
  sku,
  name: `Pieza ${sku}`,
  category_id: "category-brakes",
  honda_code: "45022-HON-001",
  description: "Descripción guardada",
  brand_id: "existing-brand",
  honda_relation: "compatible",
  homologation_reference: null,
  price_uyu: 1250.5,
  stock: 7,
  availability: "a_pedido",
  image_url: "/images/saved-product.jpg",
  promo_text: "Promoción existente",
  active: true,
  is_demo: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

function record(
  sku: string,
  values: Record<string, unknown> = {},
  sheetName = "Productos",
  rowNumber = 2,
): ImportRecord {
  return {
    sheetName,
    rowNumber,
    record: { SKU: sku, NAME: `Pieza ${sku}`, CategoryID: "category-brakes", ...values },
  };
}
function application(
  sku: string,
  modelId = "model-civic",
  values: Record<string, unknown> = {},
): ImportRecord {
  return record(sku, { ModelID: modelId, YearFrom: 2020, YearTo: 2024, ...values });
}
const zeroProgress: ImportProgress = {
  categories: 0,
  models: 0,
  createdProducts: 0,
  updatedProducts: 0,
  compatibilities: 0,
};

/** A stateful persistence fake: updates merge patches and inserts preserve DB-like defaults. */
class MemoryStore implements CatalogImportStore {
  lookups: ImportLookups = {
    categories: structuredClone(categories),
    models: structuredClone(models),
  };
  products: ProductRow[] = [];
  compatibilities: Compatibility[] = [];
  writes: { action: string; values: unknown }[] = [];
  calls: string[] = [];
  permission = true;
  failRead: "lookups" | "products" | "compatibilities" | "refresh" | null = null;
  failSaveSkus = new Set<string>();
  failCompatibilityBatch = 0;
  private lookupReads = 0;
  private compatibilityBatches = 0;
  private sequence = 0;

  async authorize() {
    this.calls.push("authorize");
    if (!this.permission) throw new Error("Sin permiso de catálogo");
  }
  async getLookups() {
    this.calls.push("getLookups");
    this.lookupReads++;
    if (this.failRead === "lookups" || (this.failRead === "refresh" && this.lookupReads > 1))
      throw new Error("Fallo de lectura de maestros");
    return structuredClone(this.lookups);
  }
  async createLookups(kind: "categories" | "models", items: CatalogLookup[]) {
    this.calls.push(`create:${kind}`);
    let count = 0;
    for (const item of items) {
      if (this.lookups[kind].some((saved) => saved.slug === item.slug)) continue;
      const saved = { ...item, id: `saved-${kind}-${++this.sequence}` };
      this.lookups[kind].push(saved);
      this.writes.push({ action: `create:${kind}`, values: structuredClone(saved) });
      count++;
    }
    return count;
  }
  async getProducts(skus: string[]) {
    this.calls.push("getProducts");
    if (this.failRead === "products") throw new Error("Fallo de lectura de productos");
    return structuredClone(this.products.filter((product) => skus.includes(product.sku)));
  }
  async getCompatibilities(productIds: string[]) {
    this.calls.push("getCompatibilities");
    if (this.failRead === "compatibilities")
      throw new Error("Fallo de lectura de compatibilidades");
    return structuredClone(
      this.compatibilities.filter((compat) => productIds.includes(compat.product_id)),
    );
  }
  async saveProduct(values: ProductWrite, existingId?: string) {
    this.calls.push(`save:${values.sku}`);
    if (this.failSaveSkus.has(values.sku)) throw new Error(`Fallo al guardar ${values.sku}`);
    const existingIndex = this.products.findIndex((product) => product.id === existingId);
    const existing = existingIndex >= 0 ? this.products[existingIndex] : undefined;
    const saved = {
      ...makeProduct(values.sku, {
        id: `saved-product-${++this.sequence}`,
        honda_code: null,
        description: null,
        brand_id: null,
        honda_relation: null,
        image_url: null,
        promo_text: null,
        price_uyu: null,
        stock: null,
        availability: "consultar",
      }),
      ...existing,
      ...values,
    } as ProductRow;
    if (existingIndex >= 0) this.products[existingIndex] = saved;
    else this.products.push(saved);
    this.writes.push({
      action: existing ? "updateProduct" : "createProduct",
      values: structuredClone(values),
    });
    return { id: saved.id, sku: saved.sku };
  }
  async addCompatibilities(values: CompatibilityWrite[]) {
    this.calls.push("addCompatibilities");
    this.compatibilityBatches++;
    if (this.failCompatibilityBatch === this.compatibilityBatches)
      throw new Error("Fallo de lote de compatibilidades");
    let count = 0;
    for (const value of values) {
      const id = await compatibilityId(value);
      if (this.compatibilities.some((saved) => saved.id === id)) continue;
      const saved = { ...value, id };
      this.compatibilities.push(saved);
      this.writes.push({ action: "addCompatibility", values: structuredClone(saved) });
      count++;
    }
    return count;
  }
}

beforeAll(() => vi.stubGlobal("crypto", webcrypto));
afterAll(() => vi.unstubAllGlobals());

describe("catalog import preservation and authorization", () => {
  it("previews planned masters and rows without writes or mutations to saved data", () => {
    const store = new MemoryStore();
    store.products = [makeProduct("KEEP")];
    const before = structuredClone({ products: store.products, lookups: store.lookups });
    const preview = applyImportSafety(
      prepareImportRecords(
        [
          record("NEW", {
            CategoryID: "SUSP-NEW",
            CategoryName: "Bujes",
            ModelID: "ZR-V",
            YearFrom: 2024,
            YearTo: 2027,
          }),
        ],
        store.lookups.categories,
        store.lookups.models,
      ),
    );
    expect(preview.newCategories).toHaveLength(1);
    expect(preview.newModels).toHaveLength(1);
    expect(preview.rows[0]?.error).toBeNull();
    expect(store.writes).toEqual([]);
    expect(store.calls).toEqual([]);
    expect({ products: store.products, lookups: store.lookups }).toEqual(before);
  });

  it("checks permission first and performs zero reads or writes when denied", async () => {
    const store = new MemoryStore();
    store.permission = false;
    await expect(executeCatalogImport([record("P1")], store)).rejects.toMatchObject({
      message: "Sin permiso de catálogo",
      progress: zeroProgress,
    });
    expect(store.calls).toEqual(["authorize"]);
    expect(store.writes).toEqual([]);
  });

  it("blocks the entire workbook when any row is invalid, including planned master creation", async () => {
    const store = new MemoryStore();
    const rows = [
      record("P1", { CategoryID: "NEW", CategoryName: "Categoría nueva", Stock: -1 }),
      record("P2"),
    ];
    await expect(executeCatalogImport(rows, store)).rejects.toMatchObject({
      progress: zeroProgress,
    });
    expect(store.writes).toEqual([]);
    expect(store.products).toEqual([]);
    expect(store.lookups.categories).toEqual(categories);
  });

  it.each(["lookups", "products", "compatibilities"] as const)(
    "makes no mutations if the initial %s read fails",
    async (failure) => {
      const store = new MemoryStore();
      store.failRead = failure;
      const rows = [
        record("P1", {
          CategoryID: "NEW",
          CategoryName: "Categoría nueva",
          ModelID: "ZR-V",
          YearFrom: 2023,
          YearTo: 2027,
        }),
      ];
      await expect(executeCatalogImport(rows, store)).rejects.toMatchObject({
        progress: zeroProgress,
      });
      expect(store.writes).toEqual([]);
      expect(store.lookups).toEqual({ categories, models });
    },
  );

  it("preserves omitted or blank commercial fields and unrelated metadata on existing products", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("P1")];
    const original = structuredClone(store.products[0]);
    const result = await executeCatalogImport(
      [
        record("P1", {
          NAME: "Nombre actualizado",
          Price: "",
          Stock: "",
          Active: "",
          HondaCode: "",
          Description: "",
          Availability: "",
        }),
      ],
      store,
    );
    expect(result).toEqual({ ...zeroProgress, updatedProducts: 1 });
    expect(store.products[0]).toEqual({ ...original, name: "Nombre actualizado" });
    const patch = store.writes.find((write) => write.action === "updateProduct")?.values;
    expect(patch).toEqual({
      sku: "P1",
      name: "Nombre actualizado",
      category_id: "category-brakes",
    });
  });

  it("persists explicit zero and false without treating them as blank cells", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("P1")];
    await executeCatalogImport([record("P1", { Price: 0, Stock: 0, Active: false })], store);
    expect(store.products[0]).toMatchObject({
      price_uyu: 0,
      stock: 0,
      active: false,
      availability: "a_pedido",
    });
  });

  it("retains the bundled baseline's price, stock, Honda code and metadata on its first database import", async () => {
    const store = new MemoryStore();
    const local = bundledCatalog[0]!;
    const snapshot = JSON.stringify(bundledCatalog);
    await executeCatalogImport(
      [record(local.sku, { NAME: local.name, CategoryID: "category-filters" })],
      store,
    );
    expect(store.products[0]).toMatchObject({
      sku: local.sku,
      price_uyu: local.price_uyu,
      stock: local.stock,
      honda_code: local.honda_code,
      description: local.description,
      availability: local.availability,
      active: local.active,
      honda_relation: local.honda_relation,
      homologation_reference: local.homologation_reference,
      image_url: local.image_url,
      promo_text: local.promo_text,
      is_demo: local.is_demo,
    });
    expect(JSON.stringify(bundledCatalog)).toBe(snapshot);
  });

  it("rejects deactivating bundled products before mutation, because public RLS would otherwise reveal the baseline again", async () => {
    const store = new MemoryStore();
    const local = bundledCatalog[0]!;
    await expect(
      executeCatalogImport([record(local.sku, { Active: false })], store),
    ).rejects.toMatchObject({
      progress: zeroProgress,
      message: expect.stringContaining("catálogo verificado"),
    });
    expect(store.writes).toEqual([]);
  });

  it("keeps old applications and notes while adding only a newly supplied application", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("P1")];
    const saved: Compatibility = {
      id: "old-app",
      product_id: "product-P1",
      model_id: "model-civic",
      year_from: 2010,
      year_to: 2015,
      notes: "Aplicación verificada anteriormente",
    };
    store.compatibilities = [saved];
    const result = await executeCatalogImport([application("P1", "model-fit")], store);
    expect(store.compatibilities).toContainEqual(saved);
    expect(store.compatibilities).toHaveLength(2);
    expect(result.compatibilities).toBe(1);
  });

  it("preserves nonempty saved notes when the same application is imported with blank notes", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("P1")];
    const saved: Compatibility = {
      id: "old-app",
      product_id: "product-P1",
      model_id: "model-civic",
      year_from: 2020,
      year_to: 2024,
      notes: "Solo motor 1.8",
    };
    store.compatibilities = [saved];
    const result = await executeCatalogImport(
      [application("P1", "model-civic", { CompatibilityNotes: "" })],
      store,
    );
    expect(store.compatibilities).toEqual([saved]);
    expect(result.compatibilities).toBe(0);
  });

  it("creates each product once across sheets and preserves all explicit model applications on repeat import", async () => {
    const store = new MemoryStore();
    const rows = [
      { ...application("P1"), sheetName: "Civic" },
      { ...application("P1", "model-fit"), sheetName: "Fit", rowNumber: 8 },
    ];
    const first = await executeCatalogImport(rows, store);
    expect(first).toEqual({ ...zeroProgress, createdProducts: 1, compatibilities: 2 });
    const saved = structuredClone({
      products: store.products,
      compatibilities: store.compatibilities,
    });
    const second = await executeCatalogImport(rows, store);
    expect(second).toEqual({ ...zeroProgress, updatedProducts: 1 });
    expect({ products: store.products, compatibilities: store.compatibilities }).toEqual(saved);
    expect(store.writes.filter((write) => write.action === "createProduct")).toHaveLength(1);
  });

  it("creates planned categories/models only on execution, refreshes them and persists actual IDs", async () => {
    const store = new MemoryStore();
    const rows = [
      record("P1", {
        CategoryID: "SUSP-01",
        CategoryName: "Bujes",
        ModelID: "ZR-V",
        YearFrom: 2025,
        YearTo: 2027,
      }),
    ];
    const preview = prepareImportRecords(rows, store.lookups.categories, store.lookups.models);
    expect(preview.rows[0]?.categoryId).toContain("pending-");
    expect(store.writes).toEqual([]);
    const result = await executeCatalogImport(rows, store);
    expect(result).toEqual({
      ...zeroProgress,
      categories: 1,
      models: 1,
      createdProducts: 1,
      compatibilities: 1,
    });
    const category = store.lookups.categories.find((item) => item.slug === "susp-01")!;
    const model = store.lookups.models.find((item) => item.slug === "zr-v")!;
    expect(store.products[0]?.category_id).toBe(category.id);
    expect(store.compatibilities[0]?.model_id).toBe(model.id);
    expect(JSON.stringify(store.writes)).not.toContain("pending-");
    expect(store.calls.indexOf("getCompatibilities")).toBeLessThan(
      store.calls.indexOf("create:categories"),
    );
  });

  it("never includes existing-only metadata or blank fields in a partial product patch", () => {
    const row = prepareImportRecords([record("P1", { Price: 2000 })], categories, models).rows[0]!;
    expect(productWriteFromRow(row, makeProduct("P1"))).toEqual({
      sku: "P1",
      name: "Pieza P1",
      category_id: "category-brakes",
      price_uyu: 2000,
    });
  });
});

describe("catalog import partial failure reporting", () => {
  it("reports every confirmed save in a concurrent batch, stops later batches and preserves old compatibility", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("A")];
    const old: Compatibility = {
      id: "old",
      product_id: "product-A",
      model_id: "model-fit",
      year_from: 2010,
      year_to: 2015,
      notes: "Anterior",
    };
    store.compatibilities = [old];
    store.failSaveSkus.add("B");
    const reports: ImportProgress[] = [];
    const error = await executeCatalogImport(
      ["A", "B", "C", "D", "E"].map((sku) => application(sku)),
      store,
      (progress) => reports.push(progress),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CatalogImportError);
    expect(error).toMatchObject({
      message: "Fallo al guardar B",
      progress: { ...zeroProgress, updatedProducts: 1, createdProducts: 2 },
    });
    expect(store.products.map((product) => product.sku).sort()).toEqual(["A", "C", "D"]);
    expect(store.calls).not.toContain("save:E");
    expect(store.compatibilities).toEqual([old]);
    expect(reports.map((progress) => progress.createdProducts + progress.updatedProducts)).toEqual([
      1, 2, 3,
    ]);
  });

  it("reports committed masters if refreshing their IDs fails and leaves products untouched", async () => {
    const store = new MemoryStore();
    store.failRead = "refresh";
    const error = await executeCatalogImport(
      [
        record("P1", {
          CategoryID: "NEW",
          CategoryName: "Categoría nueva",
          ModelID: "ZR-V",
          YearFrom: 2024,
          YearTo: 2027,
        }),
      ],
      store,
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ progress: { ...zeroProgress, categories: 1, models: 1 } });
    expect(store.products).toEqual([]);
    expect(store.compatibilities).toEqual([]);
  });

  it("counts only successfully committed compatibility batches and can resume the same workbook", async () => {
    const store = new MemoryStore();
    store.products = [makeProduct("P1")];
    store.lookups.models = Array.from({ length: 201 }, (_, index) => ({
      id: `model-${index}`,
      name: `Modelo ${index}`,
      slug: `m-${index}`,
    }));
    const rows = store.lookups.models.map((model) => application("P1", model.id));
    store.failCompatibilityBatch = 2;
    const error = await executeCatalogImport(rows, store).catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      progress: { ...zeroProgress, updatedProducts: 1, compatibilities: 200 },
    });
    expect(store.compatibilities).toHaveLength(200);
    store.failCompatibilityBatch = 0;
    const resumed = await executeCatalogImport(rows, store);
    expect(resumed).toEqual({ ...zeroProgress, updatedProducts: 1, compatibilities: 1 });
    expect(store.compatibilities).toHaveLength(201);
  });
});

describe("idempotent compatibility identifiers", () => {
  it("uses a deterministic UUID for equal applications and distinct IDs for changed keys or notes", async () => {
    const base: CompatibilityWrite = {
      product_id: "product-P1",
      model_id: "model-civic",
      year_from: 2020,
      year_to: 2024,
      notes: "Motor A",
    };
    const id = await compatibilityId(base);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await compatibilityId({ ...base, notes: " Motor A " })).toBe(id);
    expect(await compatibilityId({ ...base, year_to: 2025 })).not.toBe(id);
    expect(await compatibilityId({ ...base, notes: "Motor B" })).not.toBe(id);
    expect(await compatibilityId({ ...base, notes: "" })).toBe(
      await compatibilityId({ ...base, notes: null }),
    );
  });
});
