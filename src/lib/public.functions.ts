import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FILTER_SUBCATEGORY_SLUGS } from "@/lib/filter-categories";
import filtrosData from "@/data/filtros.json";
import webFichasData from "@/data/catalogo-web-fichas.json";
import amortiguadoresData from "@/data/amortiguadores.json";
import bateriasData from "@/data/baterias.json";
import bujiasData from "@/data/bujias.json";
import capotData from "@/data/capot.json";
import correasData from "@/data/correas.json";
import cristalesDePuertasData from "@/data/cristales-de-puertas.json";

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
  // Keep every model represented by workbook compatibility even when the
  // database does not yet have a matching vehicle_models row.
  const localModels = new Map<string, string>();
  for (const p of localProducts) for (const c of p.compat) {
    if (c.model_slug && c.model) localModels.set(c.model_slug, c.model);
  }
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
  for (const [slug, name] of localModels) {
    if (!existingSlugs.has(slug) && !additionalModels.some((m) => m.slug === slug)) {
      additionalModels.push({ id: `model-${slug}`, name, slug, sort_order: 10 + additionalModels.length });
    }
  }
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

const localProducts = [
  ...filtrosData,
  ...amortiguadoresData,
  ...bateriasData,
  ...bujiasData,
  ...capotData,
  ...correasData,
  ...cristalesDePuertasData,
  ...webFichasData,
] as CatalogProduct[];

function filterLocalProducts(data: CatalogQuery): CatalogProduct[] {
  if (data.marca) return [];

  const qNorm = data.q?.toLowerCase().trim();

  return localProducts.filter((p) => {
    if (data.categoria === "filtros") {
      if (!p.category?.slug.startsWith("filtros-") && p.category?.slug !== "filtros") return false;
    } else if (data.categoria && p.category?.slug !== data.categoria) {
      return false;
    }

    if (data.modelo) {
      const matchModel = p.compat.some(
        (c) => c.model_slug === data.modelo,
      );
      if (!matchModel) return false;
    }

    if (data.anio) {
      const matchYear = p.compat.some((c) => {
        if (data.modelo && c.model_slug !== data.modelo) {
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
    const matchingLocalProducts = filterLocalProducts(data);

    // Keep filter subcategories local; all other categories combine workbook and database products.
    if (data.categoria && FILTER_SUBCATEGORY_SLUGS.some((s) => s === data.categoria)) {
      return matchingLocalProducts;
    }

    const sb = publicClient();
    const args: { _q?: string; _category?: string; _model?: string; _year?: number; _brand?: string } = {};
    if (data.q) args._q = data.q;
    if (data.categoria) args._category = data.categoria;
    if (data.modelo) args._model = data.modelo;
    if (data.anio) args._year = data.anio;
    if (data.marca) args._brand = data.marca;

    const { data: rows, error } = await sb.rpc("search_products", args);
    // Workbook-backed items remain available if the database search is unavailable.\n    if (error) return matchingLocalProducts;

    const enriched = await enrich(sb, (rows ?? []) as ProductRow[]);
    // The workbook-backed products replace the legacy examples in these categories.
    const nonDemoEnriched = enriched.filter((p) =>
      !p.sku.startsWith("DEMO-FIL-") && p.sku !== "DEMO-COR-001",
    );

    // Uploaded records take precedence over JSON seed rows with the same SKU.
    // This avoids duplicate product cards after a previously local filter is imported.
    // Keep the most recently imported workbook SKU, while preserving previous source-only products.
    const uniqueBySku = new Map(matchingLocalProducts.map((product) => [product.sku, product] as const));
    for (const product of nonDemoEnriched) uniqueBySku.set(product.sku, product);
    return [...uniqueBySku.values()];
  });


/**
 * A home-page product type is the descriptive category name of its source workbook.
 * WEB - Fichas uses CategoryID for that descriptive name and CategoryName for the
 * source's short abbreviation; we preserve the readable name in the catalog.
 *
 * A Honda code appears exactly once in each product type. Different SKUs with
 * the same code contribute their full set of vehicle/year applications.
 */
export interface HomeProductCode {
  hondaCode: string;
  name: string;
  models: { name: string; slug: string; yearFrom: number; yearTo: number }[];
}

export interface HomeProductType {
  slug: string;
  name: string;
  productCodes: HomeProductCode[];
}

export function groupCatalogByHondaCode(products: CatalogProduct[]): HomeProductType[] {
  const grouped = new Map<string, {
    name: string;
    codes: Map<string, {
      hondaCode: string;
      name: string;
      models: Map<string, { name: string; slug: string; yearFrom: number; yearTo: number }>;
    }>;
  }>();

  for (const product of products) {
    if (!product.active || !product.honda_code?.trim() || !product.category) continue;
    const categorySlug = product.category.slug.startsWith("filtros-")
      ? "filtros" : product.category.slug;
    const categoryName = categorySlug === "filtros" ? "Filtros" : product.category.name;
    if (!grouped.has(categorySlug)) grouped.set(categorySlug, { name: categoryName, codes: new Map() });
    const category = grouped.get(categorySlug)!;
    const hondaCode = product.honda_code.trim().toUpperCase();
    const codeKey = hondaCode.replace(/[\s-]/g, "");
    if (!category.codes.has(codeKey)) {
      category.codes.set(codeKey, { hondaCode, name: product.name, models: new Map() });
    }
    const part = category.codes.get(codeKey)!;
    for (const application of product.compat) {
      const key = `${application.model_slug}:${application.year_from}:${application.year_to}`;
      part.models.set(key, {
        name: application.model,
        slug: application.model_slug,
        yearFrom: application.year_from,
        yearTo: application.year_to,
      });
    }
  }

  return [...grouped.entries()].map(([slug, value]) => ({
    slug,
    name: value.name,
    productCodes: [...value.codes.values()].map((part) => ({
      hondaCode: part.hondaCode,
      name: part.name,
      models: [...part.models.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "es") || a.yearFrom - b.yearFrom),
    })).sort((a, b) => a.name.localeCompare(b.name, "es") || a.hondaCode.localeCompare(b.hondaCode)),
  })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const getHomeProductTypes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data: rows, error } = await sb.rpc("search_products", {});
  if (error) return groupCatalogByHondaCode(localProducts);
  const dbProducts = (rows ?? []) as ProductRow[];
  const all = new Map<string, CatalogProduct>();
  for (const product of localProducts) all.set(product.sku, product);
  for (const product of await enrich(sb, dbProducts)) {
    if (!product.sku.startsWith("DEMO-FIL-") && product.sku !== "DEMO-COR-001") {
      all.set(product.sku, product);
    }
  }
  return groupCatalogByHondaCode([...all.values()]);
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
