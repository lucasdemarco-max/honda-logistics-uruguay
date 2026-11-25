import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FILTER_SUBCATEGORY_SLUGS } from "@/lib/filter-categories";
import filtrosData from "@/data/filtros.json";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type VehicleModel = Database["public"]["Tables"]["vehicle_models"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export interface CatalogProduct extends ProductRow {
  category: Pick<Category, "id" | "name" | "slug" | "image_key"> | null;
  brand: Pick<Brand, "id" | "name" | "slug"> | null;
  compat: { model: string; model_slug: string; year_from: number; year_to: number; notes: string | null }[];
}

export const getCatalogMeta = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [cats, models, brands] = await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("vehicle_models").select("*").order("sort_order"),
    sb.from("brands").select("id, name, slug, segment, is_demo").eq("active", true).order("sort_order"),
  ]);

  const dbModels = (models.data ?? []) as VehicleModel[];
  const existingSlugs = new Set(dbModels.map((m) => m.slug));
  const additionalModels: VehicleModel[] = [];
  const modelOrder = ["ridgeline", "zr-v", "odyssey", "type-r"];
  const modelDisplay: Record<string, string> = {
    ridgeline: "Ridgeline",
    "zr-v": "ZR-V",
    odyssey: "Odyssey",
    "type-r": "Civic Type R",
  };

  for (const slug of modelOrder) {
    if (!existingSlugs.has(slug)) {
      additionalModels.push({
        id: `model-${slug}`,
        name: modelDisplay[slug] || slug.toUpperCase(),
        slug,
        sort_order: 10 + additionalModels.length,
      });
    }
  }

  const otros = dbModels.find((m) => m.slug === "otros");
  const withoutOtros = dbModels.filter((m) => m.slug !== "otros");
  const finalModels = [...withoutOtros, ...additionalModels, ...(otros ? [otros] : [])];

  return {
    categories: (cats.data ?? []) as Category[],
    models: finalModels,
    brands: brands.data ?? [],
  };
});

export interface CatalogQuery {
  q?: string | undefined;
  categoria?: string | undefined;
  modelo?: string | undefined;
  anio?: number | undefined;
  marca?: string | undefined;
}

async function enrich(sb: ReturnType<typeof publicClient>, products: ProductRow[]): Promise<CatalogProduct[]> {
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);
  const [compat, cats, brands] = await Promise.all([
    sb
      .from("product_compatibilities")
      .select("product_id, year_from, year_to, notes, model:vehicle_models(name, slug, sort_order)")
      .in("product_id", ids),
    sb.from("categories").select("id, name, slug, image_key"),
    sb.from("brands").select("id, name, slug"),
  ]);
  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const brandMap = new Map((brands.data ?? []).map((b) => [b.id, b]));
  return products.map((p) => ({
    ...p,
    category: p.category_id ? (catMap.get(p.category_id) ?? null) : null,
    brand: p.brand_id ? (brandMap.get(p.brand_id) ?? null) : null,
    compat: (compat.data ?? [])
      .filter((c) => c.product_id === p.id && c.model)
      .sort((a, b) => (a.model!.sort_order ?? 0) - (b.model!.sort_order ?? 0))
      .map((c) => ({
        model: c.model!.name,
        model_slug: c.model!.slug,
        year_from: c.year_from,
        year_to: c.year_to,
        notes: c.notes,
      })),
  }));
}

function filterFiltrosLocal(data: CatalogQuery): CatalogProduct[] {
  if (data.marca) return [];

  const isFiltrosCategory =
    !data.categoria ||
    data.categoria === "filtros" ||
    FILTER_SUBCATEGORY_SLUGS.some((slug) => slug === data.categoria);

  if (!isFiltrosCategory) return [];

  const qNorm = data.q?.toLowerCase().trim();
  const allFilters = filtrosData as unknown as CatalogProduct[];

  return allFilters.filter((p) => {
    if (data.categoria && data.categoria !== "filtros") {
      if (p.category?.slug !== data.categoria) return false;
    }

    if (data.modelo) {
      const matchModel = p.compat.some(
        (c) => c.model_slug === data.modelo || c.model.toLowerCase() === data.modelo!.toLowerCase(),
      );
      if (!matchModel) return false;
    }

    if (data.anio) {
      const matchYear = p.compat.some((c) => {
        if (data.modelo && c.model_slug !== data.modelo && c.model.toLowerCase() !== data.modelo!.toLowerCase()) {
          return false;
        }
        return data.anio! >= c.year_from && data.anio! <= c.year_to;
      });
      if (!matchYear) return false;
    }

    if (qNorm) {
      const inName = p.name.toLowerCase().includes(qNorm);
      const inSku = p.sku.toLowerCase().includes(qNorm);
      const inHondaCode = (p.honda_code ?? "").toLowerCase().includes(qNorm);
      const inDesc = (p.description ?? "").toLowerCase().includes(qNorm);
      if (!inName && !inSku && !inHondaCode && !inDesc) return false;
    }

    return true;
  });
}

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator((input: CatalogQuery) => ({
    q: typeof input?.q === "string" ? input.q.slice(0, 80) : undefined,
    categoria: typeof input?.categoria === "string" ? input.categoria.slice(0, 60) : undefined,
    modelo: typeof input?.modelo === "string" ? input.modelo.slice(0, 60) : undefined,
    anio: typeof input?.anio === "number" && input.anio > 1970 && input.anio < 2100 ? input.anio : undefined,
    marca: typeof input?.marca === "string" ? input.marca.slice(0, 60) : undefined,
  }))
  .handler(async ({ data }) => {
    const localFilters = filterFiltrosLocal(data);

    // If searching strictly within filters, return the local verified list directly
    if (data.categoria === "filtros" || (data.categoria && FILTER_SUBCATEGORY_SLUGS.some((s) => s === data.categoria))) {
      return localFilters;
    }

    const sb = publicClient();
    const args: { _q?: string; _category?: string; _model?: string; _year?: number; _brand?: string } = {};
    if (data.q) args._q = data.q;
    if (data.categoria) args._category = data.categoria;
    if (data.modelo) args._model = data.modelo;
    if (data.anio) args._year = data.anio;
    if (data.marca) args._brand = data.marca;

    const { data: rows, error } = await sb.rpc("search_products", args);
    if (error) throw new Error("No pudimos cargar el catálogo");

    const enriched = await enrich(sb, (rows ?? []) as ProductRow[]);
    // Filter out old demo filter products so real filters take precedence
    const nonDemoEnriched = enriched.filter((p) => !p.sku.startsWith("DEMO-FIL-"));

    // Uploaded records take precedence over JSON seed rows with the same SKU.
    // This avoids duplicate product cards after a previously local filter is imported.
    const uniqueBySku = new Map(localFilters.map((product) => [product.sku, product] as const));
    for (const product of nonDemoEnriched) uniqueBySku.set(product.sku, product);
    return [...uniqueBySku.values()];
  });

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb.from("brands").select("*").eq("active", true).order("sort_order");
  return (data ?? []) as Brand[];
});

export const getBrand = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 80) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: brand } = await sb.from("brands").select("*").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!brand) return null;
    const { data: products } = await sb
      .from("products")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("active", true)
      .order("name");
    return { brand: brand as Brand, products: await enrich(sb, (products ?? []) as ProductRow[]) };
  });
