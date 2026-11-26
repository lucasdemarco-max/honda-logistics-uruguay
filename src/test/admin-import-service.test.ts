import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import filtrosData from "@/data/filtros.json";
import {
  executeImport,
  legacyProductDefaults,
  ImportExecutionError,
} from "@/lib/admin-import-service";
import type { ImportRecord } from "@/lib/admin-import";

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | Row | null; error: { message: string } | null };
function database() {
  const tables: Record<string, Row[]> = {
    categories: [{ id: "filters-id", name: "Filtros", slug: "filtros" }],
    vehicle_models: [
      { id: "civic-id", name: "Civic", slug: "civic" },
      { id: "fit-id", name: "Fit", slug: "fit" },
    ],
    products: [
      {
        id: "p1",
        sku: "S1",
        name: "Filtro",
        category_id: "filters-id",
        price_uyu: 500,
        stock: 7,
        honda_code: "15400-ABC",
        description: "Conservar",
        availability: "en_stock",
        active: false,
        image_url: "photo.jpg",
        brand_id: "brand1",
      },
      { id: "p2", sku: "UNTOUCHED", price_uyu: 800 },
    ],
    product_compatibilities: [
      {
        id: "a1",
        product_id: "p1",
        model_id: "civic-id",
        year_from: 2016,
        year_to: 2021,
        notes: "Verificado",
      },
      {
        id: "a2",
        product_id: "p1",
        model_id: "fit-id",
        year_from: 2010,
        year_to: 2015,
        notes: null,
      },
    ],
  };
  const writes: { table: string; mode: string; values: Row[] }[] = [];
  let counter = 10;
  const flags = { allowed: true, failCompat: false, failSku: "" };
  class Query {
    mode = "read";
    payload: Row[] = [];
    predicates: ((row: Row) => boolean)[] = [];
    singleRow = false;
    start = 0;
    end = Infinity;
    constructor(public table: string) {}
    select() {
      return this;
    }
    order() {
      return this;
    }
    range(start: number, end: number) {
      this.start = start;
      this.end = end;
      return this;
    }
    in(key: string, values: unknown[]) {
      this.predicates.push((row) => values.includes(row[key]));
      return this;
    }
    eq(key: string, value: unknown) {
      this.predicates.push((row) => row[key] === value);
      return this;
    }
    is(key: string, value: unknown) {
      return this.eq(key, value);
    }
    single() {
      this.singleRow = true;
      return this;
    }
    insert(value: Row | Row[]) {
      this.mode = "insert";
      this.payload = Array.isArray(value) ? value : [value];
      return this;
    }
    update(value: Row) {
      this.mode = "update";
      this.payload = [value];
      return this;
    }
    then(resolve: (value: QueryResult) => unknown) {
      if (
        this.mode !== "read" &&
        this.table === "products" &&
        this.payload.some((row) => row["sku"] === flags.failSku)
      )
        return Promise.resolve(resolve({ data: null, error: { message: "Falla en producto" } }));
      if (flags.failCompat && this.table === "product_compatibilities" && this.mode === "insert")
        return Promise.resolve(resolve({ data: null, error: { message: "Falla simulada" } }));
      const existing = tables[this.table]!;
      let result = existing.filter((row) => this.predicates.every((predicate) => predicate(row)));
      if (this.mode === "insert") {
        result = this.payload.map((row) => ({ id: `id-${counter++}`, ...row }));
        existing.push(...result);
      } else if (this.mode === "update")
        result.forEach((row) => Object.assign(row, this.payload[0]));
      if (this.mode !== "read")
        writes.push({
          table: this.table,
          mode: this.mode,
          values: this.payload.map((row) => ({ ...row })),
        });
      result = result.slice(this.start, this.end + 1);
      return Promise.resolve(
        resolve({ data: this.singleRow ? (result[0] ?? null) : result, error: null }),
      );
    }
  }
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin" } }, error: null })) },
    rpc: vi.fn(async () => ({ data: flags.allowed, error: null })),
    from: (table: string) => new Query(table),
  } as unknown as SupabaseClient<Database>;
  return { client, tables, writes, flags };
}
const record = (overrides: Row = {}, rowNumber = 2): ImportRecord => ({
  rowNumber,
  record: {
    SKU: "S1",
    Name: "Filtro",
    CategoryID: "filters-id",
    ModelID: "civic-id",
    YearFrom: 2016,
    YearTo: 2021,
    ...overrides,
  },
});

describe("non-destructive import persistence", () => {
  it("updates only supplied fields, preserves unrelated products and applications, and is idempotent", async () => {
    const db = database();
    const originalOther = structuredClone(db.tables["products"]![1]);
    const records = [
      record({ Price: "", Stock: "", Active: "", Description: "" }),
      record({ ModelID: "fit-id", YearFrom: 2020, YearTo: 2024 }, 3),
    ];
    const first = await executeImport(db.client, records);
    expect(first).toMatchObject({ products: 1, compatibilities: 1 });
    expect(db.tables["products"]![0]).toMatchObject({
      price_uyu: 500,
      stock: 7,
      active: false,
      description: "Conservar",
      honda_code: "15400-ABC",
      image_url: "photo.jpg",
      brand_id: "brand1",
    });
    expect(db.tables["products"]![1]).toEqual(originalOther);
    expect(db.tables["product_compatibilities"]).toHaveLength(3);
    const second = await executeImport(db.client, records);
    expect(second.compatibilities).toBe(0);
    expect(db.tables["product_compatibilities"]).toHaveLength(3);
    expect(db.tables["product_compatibilities"]![0]?.["notes"]).toBe("Verificado");
  });

  it("preserves explicit zero and false and creates new categories/models after validation", async () => {
    const db = database();
    const result = await executeImport(db.client, [
      record({
        SKU: "NEW",
        CategoryID: "sensores",
        CategoryName: "Sensores",
        ModelID: "PLATFORM-A",
        ModelName: "Plataforma A",
        Price: 0,
        Stock: 0,
        Active: false,
      }),
    ]);
    expect(result).toMatchObject({ categories: 1, models: 1, products: 1, compatibilities: 1 });
    const product = db.tables["products"]!.find((item) => item["sku"] === "NEW");
    expect(product).toMatchObject({ price_uyu: 0, stock: 0, active: false, is_demo: false });
    expect(
      db.tables["vehicle_models"]!.find((item) => item["slug"] === "platform-a"),
    ).toBeDefined();
  });

  it("rejects permission, validation and existing note conflicts before any write", async () => {
    for (const scenario of ["permission", "invalid", "notes"]) {
      const db = database();
      db.flags.allowed = scenario !== "permission";
      const row = record(
        scenario === "invalid"
          ? { Stock: -1, CategoryID: "new", CategoryName: "Nueva" }
          : scenario === "notes"
            ? { CompatibilityNotes: "Contradictorio" }
            : {},
      );
      await expect(executeImport(db.client, [row])).rejects.toBeInstanceOf(ImportExecutionError);
      expect(db.writes).toHaveLength(0);
    }
  });

  it("reports partial progress and a retry adds only missing applications", async () => {
    const db = database();
    db.flags.failCompat = true;
    const rows = [record({ ModelID: "fit-id", YearFrom: 2020, YearTo: 2024 })];
    await expect(executeImport(db.client, rows)).rejects.toMatchObject({
      progress: { products: 1, compatibilities: 0 },
    });
    expect(db.tables["product_compatibilities"]).toHaveLength(2);
    db.flags.failCompat = false;
    const retry = await executeImport(db.client, rows);
    expect(retry.compatibilities).toBe(1);
    expect(db.tables["product_compatibilities"]).toHaveLength(3);
  });

  it("uses the existing local product as defaults when first inserting its SKU into the database", async () => {
    const db = database();
    const legacy = filtrosData[0]!;
    await executeImport(db.client, [
      record({ SKU: legacy.sku, Name: legacy.name, ModelID: "", YearFrom: "", YearTo: "" }),
    ]);
    const inserted = db.tables["products"]!.find((item) => item["sku"] === legacy.sku);
    expect(inserted).toMatchObject({
      price_uyu: legacy.price_uyu,
      stock: legacy.stock,
      honda_code: legacy.honda_code,
      description: legacy.description,
      homologation_reference: legacy.homologation_reference,
    });
    expect(inserted?.["id"]).not.toBe(legacy.id);
    expect(legacyProductDefaults("NONEXISTENT")).toEqual({});
  });
  it("accounts for every completed product write when one operation in a batch fails", async () => {
    const db = database();
    db.flags.failSku = "BROKEN";
    await expect(
      executeImport(db.client, [record(), record({ SKU: "BROKEN" }, 3)]),
    ).rejects.toMatchObject({ progress: { products: 1 } });
    expect(db.tables["products"]!.some((item) => item["sku"] === "BROKEN")).toBe(false);
    expect(db.tables["product_compatibilities"]).toHaveLength(2);
  });
  it("completes an empty note without losing existing nonempty notes", async () => {
    const db = database();
    db.tables["product_compatibilities"]![1]!["notes"] = "";
    const result = await executeImport(db.client, [
      record({
        ModelID: "fit-id",
        YearFrom: 2010,
        YearTo: 2015,
        CompatibilityNotes: "Nueva observación",
      }),
    ]);
    expect(result.notes).toBe(1);
    expect(db.tables["product_compatibilities"]![1]!["notes"]).toBe("Nueva observación");
    expect(db.tables["product_compatibilities"]![0]!["notes"]).toBe("Verificado");
  });
});
