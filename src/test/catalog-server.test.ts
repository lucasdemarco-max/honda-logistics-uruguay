import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface QueryTrace {
  role: "public" | "admin";
  table: string;
  columns?: string;
  equal: [string, unknown][];
  included: [string, unknown[]][];
  order: string[];
  range?: [number, number];
}

const state = vi.hoisted(() => ({
  data: {} as Record<string, Record<string, unknown>[]>,
  traces: [] as QueryTrace[],
  errors: {} as Record<string, string>,
  createClient: vi.fn(),
  publicClient: {} as { from: (table: string) => unknown },
  adminClient: {} as { from: (table: string) => unknown },
  bundled: [1, 2].map((number) => ({
    id: `local-${number}`,
    sku: `BUNDLE-00${number}`,
    name: `Producto local ${number}`,
    honda_code: null,
    description: null,
    category_id: "local-filter-category",
    brand_id: null,
    honda_relation: null,
    homologation_reference: null,
    price_uyu: null,
    stock: null,
    availability: "consultar",
    image_url: null,
    promo_text: null,
    active: true,
    is_demo: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    category: {
      id: "local-filter-category",
      name: "Filtros",
      slug: "filtros",
      image_key: "filtros",
    },
    brand: null,
    compat: [{ model: "Civic", model_slug: "civic", year_from: 2015, year_to: 2025, notes: null }],
  })),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: state.createClient }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: state.adminClient }));
vi.mock("@/data/filtros.json", () => ({ default: state.bundled }));

import { loadCatalogSnapshot, publicCatalogClient, readCatalogPages } from "@/lib/catalog.server";

function mockQuery(role: QueryTrace["role"], table: string) {
  const trace: QueryTrace = { role, table, equal: [], included: [], order: [] };
  state.traces.push(trace);
  const execute = () => {
    const error = state.errors[`${role}:${table}`];
    if (error) return Promise.resolve({ data: null, error: { message: error } });
    let rows = [...(state.data[table] ?? [])];
    for (const [column, value] of trace.equal) rows = rows.filter((row) => row[column] === value);
    for (const [column, values] of trace.included)
      rows = rows.filter((row) => values.includes(row[column]));
    for (const column of [...trace.order].reverse())
      rows.sort((first, second) => String(first[column]).localeCompare(String(second[column])));
    if (trace.range) rows = rows.slice(trace.range[0], trace.range[1] + 1);
    if (trace.columns && trace.columns !== "*") {
      const columns = trace.columns.split(",").map((column) => column.trim());
      rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
    }
    return Promise.resolve({ data: rows, error: null });
  };
  const query = {
    select(columns: string) {
      trace.columns = columns;
      return query;
    },
    eq(column: string, value: unknown) {
      trace.equal.push([column, value]);
      return query;
    },
    in(column: string, values: unknown[]) {
      trace.included.push([column, values]);
      return query;
    },
    order(column: string) {
      trace.order.push(column);
      return query;
    },
    range(from: number, to: number) {
      trace.range = [from, to];
      return execute();
    },
    then: (
      resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => execute().then(resolve, reject),
  };
  return query;
}

const databaseProduct = (number: number, overrides: Record<string, unknown> = {}) => ({
  ...state.bundled[0],
  id: `product-${String(number).padStart(4, "0")}`,
  sku: `DB-${number}`,
  name: `Producto ${number}`,
  category_id: "database-filters",
  ...overrides,
});

beforeEach(() => {
  state.traces.length = 0;
  state.errors = {};
  state.data = {
    categories: [
      {
        id: "database-filters",
        name: "Filtros",
        slug: "filtros",
        image_key: "filtros",
        sort_order: 0,
        description: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    vehicle_models: [{ id: "database-civic", name: "Civic", slug: "civic", sort_order: 0 }],
    brands: [],
    products: [],
    product_compatibilities: [],
  };
  state.publicClient.from = (table) => mockQuery("public", table);
  state.adminClient.from = (table) => mockQuery("admin", table);
  state.createClient.mockReset().mockReturnValue(state.publicClient);
  vi.stubEnv("SUPABASE_URL", "https://catalog-test.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
  vi.stubEnv("VITE_SUPABASE_URL", undefined);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("public catalog server boundary", () => {
  it("reads beyond the old 200-product RPC limit and a complete 500-row page", async () => {
    state.data["products"] = Array.from({ length: 1201 }, (_, index) => databaseProduct(index));
    const snapshot = await loadCatalogSnapshot();
    expect(snapshot.products.filter((product) => product.sku.startsWith("DB-")).length).toBe(1201);
    const pages = state.traces.filter(
      (trace) => trace.role === "public" && trace.table === "products",
    );
    expect(pages.map((trace) => trace.range)).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
    expect(
      pages.every((trace) =>
        trace.equal.some(([column, value]) => column === "active" && value === true),
      ),
    ).toBe(true);
    const compatibilityQueries = state.traces.filter(
      (trace) => trace.table === "product_compatibilities",
    );
    expect(compatibilityQueries).toHaveLength(13);
    expect(compatibilityQueries.every((trace) => (trace.included[0]?.[1].length ?? 0) <= 100)).toBe(
      true,
    );
  });

  it("only uses the publishable key for catalog reads and restricts admin reads to bundled SKUs", async () => {
    state.data["products"] = [
      databaseProduct(1),
      databaseProduct(2, { sku: "BUNDLE-001", active: false, name: "PRIVATE-INACTIVE-NAME" }),
      databaseProduct(3, {
        sku: "NON-BUNDLED-INACTIVE",
        active: false,
        description: "PRIVATE-ADMIN-DATA",
      }),
    ];
    state.data["product_compatibilities"] = [
      {
        id: "public-application",
        product_id: "product-0001",
        model_id: "database-civic",
        year_from: 2020,
        year_to: 2025,
        notes: "Aplicación cargada",
      },
      {
        id: "hidden-application",
        product_id: "product-0002",
        model_id: "database-civic",
        year_from: 2020,
        year_to: 2025,
        notes: "PRIVATE-INACTIVE-NOTE",
      },
    ];
    const snapshot = await loadCatalogSnapshot();
    expect(state.createClient).toHaveBeenCalledWith(
      "https://catalog-test.invalid",
      "sb_publishable_test",
      expect.any(Object),
    );
    const adminQueries = state.traces.filter((trace) => trace.role === "admin");
    expect(adminQueries).toHaveLength(1);
    expect(adminQueries[0]).toMatchObject({
      table: "products",
      columns: "sku",
      equal: [["active", false]],
      included: [["sku", ["BUNDLE-001", "BUNDLE-002"]]],
    });
    expect(snapshot.products.map((product) => product.sku)).toEqual(["BUNDLE-002", "DB-1"]);
    expect(snapshot.products.find((product) => product.sku === "DB-1")?.compat[0]?.model_id).toBe(
      "database-civic",
    );
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE-");
    expect(JSON.stringify(snapshot)).not.toContain("test-server-only-key");
    expect(new Set(state.traces.map((trace) => trace.table))).toEqual(
      new Set(["categories", "vehicle_models", "brands", "products", "product_compatibilities"]),
    );
  });

  it("fails closed when the local inactive-product check cannot use its server key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    await expect(loadCatalogSnapshot()).rejects.toThrow(
      "No se pudo verificar el estado del catálogo local",
    );
    expect(state.traces.some((trace) => trace.role === "admin")).toBe(false);
  });

  it("does not expose database details or return stale local products when an admin lookup fails", async () => {
    state.errors["admin:products"] = "database-internal-detail";
    await expect(loadCatalogSnapshot()).rejects.toThrow(
      "No pudimos verificar los productos desactivados",
    );
    await expect(loadCatalogSnapshot()).rejects.not.toThrow("database-internal-detail");
  });

  it("does not fallback to the service key if public configuration is absent", () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
    expect(() => publicCatalogClient()).toThrow(
      "La conexión del catálogo con Supabase no está configurada",
    );
    expect(state.createClient).not.toHaveBeenCalled();
  });

  it("stops rather than returning a partial dataset when a subsequent page fails", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "sensitive database diagnostics" } });
    await expect(readCatalogPages(read, 2)).rejects.toThrow(
      "No pudimos cargar el catálogo. Intentá nuevamente.",
    );
    expect(read.mock.calls).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("checks a following empty page when the row count exactly fills a page", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    await expect(readCatalogPages(read, 2)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
