import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import bundledProducts from "@/data/filtros.json";
import {
  buildCatalogSnapshot,
  type Brand,
  type CatalogProduct,
  type CatalogSourceProduct,
  type Category,
  type ProductRow,
  type VehicleModel,
} from "@/lib/catalog";

export function publicCatalogClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("La conexión del catálogo con Supabase no está configurada.");
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

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Range reads avoid the legacy RPC's 200 row limit and PostgREST's page limit. */
export async function readCatalogPages<T>(
  read: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await read(offset, offset + pageSize - 1);
    if (result.error) throw new Error("No pudimos cargar el catálogo. Intentá nuevamente.");
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Only the fixed bundled SKU allowlist can be checked; no inactive data is returned publicly. */
async function inactiveBundledSkus(): Promise<string[]> {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    throw new Error(
      "No se pudo verificar el estado del catálogo local. Revisá la conexión de Supabase en Lovable.",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const skus = bundledProducts.map((product) => product.sku);
  const inactive: string[] = [];
  for (let index = 0; index < skus.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("sku")
      .in("sku", skus.slice(index, index + 100))
      .eq("active", false);
    if (error)
      throw new Error("No pudimos verificar los productos desactivados. Intentá nuevamente.");
    inactive.push(...(data ?? []).map((product) => product.sku));
  }
  return inactive;
}

export async function loadCatalogSnapshot() {
  const sb = publicCatalogClient();
  const [categories, models, brands, products, suppressed] = await Promise.all([
    readCatalogPages<Category>((from, to) =>
      sb.from("categories").select("*").order("id").range(from, to),
    ),
    readCatalogPages<VehicleModel>((from, to) =>
      sb.from("vehicle_models").select("*").order("id").range(from, to),
    ),
    readCatalogPages<Brand>((from, to) =>
      sb.from("brands").select("*").eq("active", true).order("id").range(from, to),
    ),
    readCatalogPages<ProductRow>((from, to) =>
      sb.from("products").select("*").eq("active", true).order("id").range(from, to),
    ),
    inactiveBundledSkus(),
  ]);
  const applications: Database["public"]["Tables"]["product_compatibilities"]["Row"][] = [];
  for (let index = 0; index < products.length; index += 100) {
    const ids = products.slice(index, index + 100).map((product) => product.id);
    applications.push(
      ...(await readCatalogPages((from, to) =>
        sb
          .from("product_compatibilities")
          .select("*")
          .in("product_id", ids)
          .order("id")
          .range(from, to),
      )),
    );
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const modelById = new Map(models.map((model) => [model.id, model]));
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const applicationsByProduct = new Map<string, CatalogProduct["compat"]>();
  for (const application of applications) {
    const model = modelById.get(application.model_id);
    if (!model) continue;
    const group = applicationsByProduct.get(application.product_id) ?? [];
    group.push({
      model_id: model.id,
      model: model.name,
      model_slug: model.slug,
      year_from: application.year_from,
      year_to: application.year_to,
      notes: application.notes,
    });
    applicationsByProduct.set(application.product_id, group);
  }
  const enriched: CatalogProduct[] = products.map((product) => ({
    ...product,
    category: categoryById.get(product.category_id ?? "") ?? null,
    brand: brandById.get(product.brand_id ?? "") ?? null,
    compat: applicationsByProduct.get(product.id) ?? [],
  }));
  return buildCatalogSnapshot(
    bundledProducts as CatalogSourceProduct[],
    enriched,
    categories,
    models,
    brands,
    suppressed,
  );
}
