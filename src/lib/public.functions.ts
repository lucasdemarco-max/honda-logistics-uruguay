import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import filtrosData from "@/data/filtros.json";
import {
  buildCatalogSnapshot,
  filterCatalog,
  readCatalogPages,
  type CatalogQuery,
  type LegacyCatalogProduct,
} from "@/lib/catalog";

export type {
  Brand,
  CatalogProduct,
  CatalogQuery,
  Category,
  ProductRow,
  VehicleModel,
} from "@/lib/catalog";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("El catálogo requiere la conexión de Supabase configurada en Lovable.");
  }
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function loadCatalog() {
  const sb = publicClient();
  // The existing search_products RPC is limited to 200 rows and accepts slugs.
  // Read through the same public RLS policies, in ordered pages, then resolve IDs.
  const [products, compatibilities, categories, models, brands] = await Promise.all([
    readCatalogPages("los productos", (from, to) =>
      sb.from("products").select("*").eq("active", true).order("id").range(from, to),
    ),
    readCatalogPages("las compatibilidades", (from, to) =>
      sb.from("product_compatibilities").select("*").order("id").range(from, to),
    ),
    readCatalogPages("las categorías", (from, to) =>
      sb.from("categories").select("*").order("id").range(from, to),
    ),
    readCatalogPages("los modelos", (from, to) =>
      sb.from("vehicle_models").select("*").order("id").range(from, to),
    ),
    readCatalogPages("las marcas", (from, to) =>
      sb.from("brands").select("*").eq("active", true).order("id").range(from, to),
    ),
  ]);
  return buildCatalogSnapshot({
    products,
    compatibilities,
    categories,
    models,
    brands,
    localProducts: filtrosData as LegacyCatalogProduct[],
  });
}

export const getCatalogMeta = createServerFn({ method: "GET" }).handler(
  async () => (await loadCatalog()).meta,
);

const textParameter = (value: unknown, maxLength: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator((input: CatalogQuery) => ({
    q: textParameter(input?.q, 80),
    categoryId: textParameter(input?.categoryId, 120),
    modelId: textParameter(input?.modelId, 120),
    categoria: textParameter(input?.categoria, 120),
    modelo: textParameter(input?.modelo, 120),
    anio:
      typeof input?.anio === "number" &&
      Number.isInteger(input.anio) &&
      input.anio >= 1970 &&
      input.anio <= 2100
        ? input.anio
        : undefined,
    marca: textParameter(input?.marca, 120),
  }))
  .handler(async ({ data }) => filterCatalog(await loadCatalog(), data));

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  return readCatalogPages("las marcas", (from, to) =>
    sb
      .from("brands")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
});

export const getBrand = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: textParameter(input?.slug, 80) ?? "" }))
  .handler(async ({ data }) => {
    const catalog = await loadCatalog();
    const brand = catalog.meta.brands.find((item) => item.slug === data.slug);
    if (!brand) return null;
    return { brand, products: filterCatalog(catalog, { marca: brand.id }) };
  });
