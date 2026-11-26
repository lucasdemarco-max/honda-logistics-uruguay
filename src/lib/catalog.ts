import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type CategoryRow = Tables["categories"]["Row"];
export type VehicleModelRow = Tables["vehicle_models"]["Row"];
export type Brand = Tables["brands"]["Row"];
export type ProductRow = Tables["products"]["Row"];
export type CompatibilityRow = Tables["product_compatibilities"]["Row"];

export interface Category extends CategoryRow {
  /** Historical IDs remain valid when a database row has the same slug. */
  aliases: string[];
}

export interface VehicleModel extends VehicleModelRow {
  aliases: string[];
}

export interface CatalogCompatibility {
  model_id: string;
  model: string;
  model_slug: string;
  year_from: number;
  year_to: number;
  notes: string | null;
}

export interface CatalogProduct extends ProductRow {
  category: Pick<Category, "id" | "name" | "slug" | "image_key"> | null;
  brand: Pick<Brand, "id" | "name" | "slug"> | null;
  compat: CatalogCompatibility[];
}

/** Existing verified files have model slugs but predate database model IDs. */
export interface LegacyCatalogProduct extends ProductRow {
  category: CatalogProduct["category"];
  brand: CatalogProduct["brand"];
  compat: (Omit<CatalogCompatibility, "model_id"> & { model_id?: string })[];
}

export interface CatalogQuery {
  q?: string | undefined;
  modelId?: string | undefined;
  categoryId?: string | undefined;
  modelo?: string | undefined;
  categoria?: string | undefined;
  anio?: number | undefined;
  marca?: string | undefined;
}

export interface CatalogFacet {
  productId: string;
  categoryId: string | null;
  modelId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface CatalogMeta {
  categories: Category[];
  models: VehicleModel[];
  brands: Brand[];
  facets: CatalogFacet[];
}

export interface CatalogSnapshot {
  products: CatalogProduct[];
  meta: CatalogMeta;
  /** Retains the legacy Filtros entry point without imposing a category taxonomy. */
  legacyFilterCategoryIds: string[];
}

interface CatalogSources {
  products: ProductRow[];
  compatibilities: CompatibilityRow[];
  categories: CategoryRow[];
  models: VehicleModelRow[];
  brands: Brand[];
  localProducts: LegacyCatalogProduct[];
}

const normalizedText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");

const byOrderThenName = <T extends { sort_order: number; name: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es");

function compatibilityKey(value: CatalogCompatibility): string {
  return JSON.stringify([value.model_id, value.year_from, value.year_to, value.notes]);
}

function uniqueCompatibilities(values: CatalogCompatibility[]): CatalogCompatibility[] {
  return [...new Map(values.map((value) => [compatibilityKey(value), value])).values()].sort(
    (a, b) =>
      a.model.localeCompare(b.model, "es") ||
      a.year_from - b.year_from ||
      a.year_to - b.year_to ||
      (a.notes ?? "").localeCompare(b.notes ?? "", "es"),
  );
}

/**
 * Reconciles the checked-in catalog with database records without changing either
 * source. The database owns product identity and commercial fields for a SKU;
 * explicit applications from both sources are retained.
 */
export function buildCatalogSnapshot(sources: CatalogSources): CatalogSnapshot {
  const categories = sources.categories.map((category) => ({
    ...category,
    aliases: [] as string[],
  }));
  const models = sources.models.map((model) => ({ ...model, aliases: [`model-${model.slug}`] }));
  const categoryBySlug = new Map(
    categories.map((category) => [normalizedText(category.slug), category]),
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const modelBySlug = new Map(models.map((model) => [normalizedText(model.slug), model]));
  const modelById = new Map(models.map((model) => [model.id, model]));
  const brandById = new Map(
    sources.brands.filter((brand) => brand.active).map((brand) => [brand.id, brand]),
  );
  const legacyFilterCategoryIds = new Set<string>();

  const localProducts = sources.localProducts.map((product): CatalogProduct => {
    let category: Category | undefined;
    if (product.category) {
      category =
        categoryById.get(product.category.id) ??
        categoryBySlug.get(normalizedText(product.category.slug));
      if (!category) {
        category = {
          ...product.category,
          description: null,
          created_at: product.created_at,
          sort_order: 1000 + categories.length,
          aliases: [],
        };
        categories.push(category);
        categoryById.set(category.id, category);
        categoryBySlug.set(normalizedText(category.slug), category);
      } else if (
        product.category.id !== category.id &&
        !category.aliases.includes(product.category.id)
      ) {
        category.aliases.push(product.category.id);
        categoryById.set(product.category.id, category);
      }
      legacyFilterCategoryIds.add(category.id);
    }

    const compat = product.compat.map((application): CatalogCompatibility => {
      let model =
        (application.model_id ? modelById.get(application.model_id) : undefined) ??
        modelBySlug.get(normalizedText(application.model_slug));
      if (!model) {
        model = {
          id: application.model_id ?? `model-${application.model_slug}`,
          name: application.model,
          slug: application.model_slug,
          sort_order: 1000 + models.length,
          aliases: [],
        };
        models.push(model);
        modelById.set(model.id, model);
        modelBySlug.set(normalizedText(model.slug), model);
      }
      if (
        application.model_id &&
        application.model_id !== model.id &&
        !model.aliases.includes(application.model_id)
      ) {
        model.aliases.push(application.model_id);
      }
      return { ...application, model_id: model.id, model: model.name, model_slug: model.slug };
    });

    return {
      ...product,
      category_id: category?.id ?? product.category_id,
      category: category ?? null,
      compat: uniqueCompatibilities(compat),
    };
  });

  // The old category link included all verified filters, plus database Filtros.
  const legacyParent = categoryBySlug.get("filtros");
  if (legacyParent) legacyFilterCategoryIds.add(legacyParent.id);

  const applicationsByProduct = new Map<string, CatalogCompatibility[]>();
  for (const application of sources.compatibilities) {
    const model = modelById.get(application.model_id);
    if (!model) continue;
    const values = applicationsByProduct.get(application.product_id) ?? [];
    values.push({
      model_id: model.id,
      model: model.name,
      model_slug: model.slug,
      year_from: application.year_from,
      year_to: application.year_to,
      notes: application.notes,
    });
    applicationsByProduct.set(application.product_id, values);
  }

  const productsBySku = new Map(localProducts.map((product) => [product.sku, product]));
  for (const product of sources.products) {
    const local = productsBySku.get(product.sku);
    productsBySku.set(product.sku, {
      ...product,
      category: product.category_id ? (categoryById.get(product.category_id) ?? null) : null,
      brand: product.brand_id ? (brandById.get(product.brand_id) ?? null) : null,
      compat: uniqueCompatibilities([
        ...(local?.compat ?? []),
        ...(applicationsByProduct.get(product.id) ?? []),
      ]),
    });
  }

  const products = [...productsBySku.values()]
    .filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.sku.localeCompare(b.sku, "es"));
  const facets = products.flatMap<CatalogFacet>((product) =>
    product.compat.length
      ? product.compat.map((application) => ({
          productId: product.id,
          categoryId: product.category_id,
          modelId: application.model_id,
          yearFrom: application.year_from,
          yearTo: application.year_to,
        }))
      : [
          {
            productId: product.id,
            categoryId: product.category_id,
            modelId: null,
            yearFrom: null,
            yearTo: null,
          },
        ],
  );
  const usedCategoryIds = new Set(facets.map((facet) => facet.categoryId));
  const usedModelIds = new Set(facets.map((facet) => facet.modelId));

  return {
    products,
    meta: {
      categories: categories
        .filter((category) => usedCategoryIds.has(category.id))
        .sort(byOrderThenName),
      models: models.filter((model) => usedModelIds.has(model.id)).sort(byOrderThenName),
      brands: [...brandById.values()].sort(byOrderThenName),
      facets,
    },
    legacyFilterCategoryIds: [...legacyFilterCategoryIds],
  };
}

function resolveLookupId(
  items: { id: string; slug: string; name: string; aliases?: string[] }[],
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const exact = items.find((item) => item.id === value || item.aliases?.includes(value));
  if (exact) return exact.id;
  const normalized = normalizedText(value);
  const matches = items.filter((item) =>
    [item.slug, item.name].some((candidate) => normalizedText(candidate) === normalized),
  );
  // An unknown or ambiguous value must produce no matches, never remove a filter.
  return matches.length === 1 ? matches[0]!.id : value;
}

export function resolveCatalogSelection(
  meta: Pick<CatalogMeta, "categories" | "models">,
  query: CatalogQuery,
): { modelId: string | undefined; categoryId: string | undefined } {
  const isLegacyFilterFamily =
    !query.categoryId && normalizedText(query.categoria ?? "") === "filtros";
  return {
    modelId: resolveLookupId(meta.models, query.modelId ?? query.modelo),
    categoryId: isLegacyFilterFamily
      ? undefined
      : resolveLookupId(meta.categories, query.categoryId ?? query.categoria),
  };
}

export function filterCatalog(snapshot: CatalogSnapshot, query: CatalogQuery): CatalogProduct[] {
  const selection = resolveCatalogSelection(snapshot.meta, query);
  const text = normalizedText(query.q ?? "");
  const legacyFilters = !query.categoryId && normalizedText(query.categoria ?? "") === "filtros";
  return snapshot.products.filter((product) => {
    if (selection.categoryId && product.category_id !== selection.categoryId) return false;
    if (
      legacyFilters &&
      (!product.category_id || !snapshot.legacyFilterCategoryIds.includes(product.category_id))
    )
      return false;
    if (query.marca && product.brand?.id !== query.marca && product.brand?.slug !== query.marca)
      return false;
    if (
      (selection.modelId || query.anio !== undefined) &&
      !product.compat.some(
        (application) =>
          (!selection.modelId || application.model_id === selection.modelId) &&
          (query.anio === undefined ||
            (query.anio >= application.year_from && query.anio <= application.year_to)),
      )
    )
      return false;
    if (
      text &&
      ![
        product.name,
        product.sku,
        product.honda_code ?? "",
        product.description ?? "",
        product.category?.name ?? "",
        ...product.compat.map((application) => application.model),
      ].some((value) => normalizedText(value).includes(text))
    )
      return false;
    return true;
  });
}

/** Fetch every page, with stable ordering supplied by the caller. */
export async function readCatalogPages<T>(
  label: string,
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error || result.data === null) {
      throw new Error(`No pudimos cargar ${label}. Intentá nuevamente.`, { cause: result.error });
    }
    all.push(...result.data);
    if (result.data.length < pageSize) return all;
  }
}
