import type { Database } from "@/integrations/supabase/types";
import { FILTER_SUBCATEGORY_SLUGS } from "@/lib/filter-categories";

type LookupAliases = { aliases?: string[] };
export type Category = Database["public"]["Tables"]["categories"]["Row"] & LookupAliases;
export type VehicleModel = Database["public"]["Tables"]["vehicle_models"]["Row"] & LookupAliases;
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

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

/** The bundled catalogue predates model_id; adapt it on read without rewriting it. */
export type CatalogSourceProduct = Omit<CatalogProduct, "compat"> & {
  compat: (Omit<CatalogCompatibility, "model_id"> & { model_id?: string })[];
};

export interface CatalogQuery {
  ModelID?: string | undefined;
  CategoryID?: string | undefined;
  modelId?: string | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
  categoria?: string | undefined;
  modelo?: string | undefined;
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
  modelCategories: { modelId: string; categoryId: string; count: number }[];
}

export interface CatalogSnapshot {
  products: CatalogProduct[];
  meta: CatalogMeta;
}

const lower = (value: string) => value.trim().toLocaleLowerCase("es");
const searchText = (value: string) =>
  lower(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** IDs win. Resolve old slugs/names only if they identify a single record. */
export function findCatalogLookup<
  T extends { id: string; name: string; slug: string } & LookupAliases,
>(items: T[], value: string | undefined): T | undefined {
  if (!value) return undefined;
  const exact = items.find((item) => item.id === value);
  if (exact) return exact;
  const slugMatches = items.filter((item) => lower(item.slug) === lower(value));
  if (slugMatches.length) return slugMatches.length === 1 ? slugMatches[0] : undefined;
  const aliases = items.filter((item) =>
    item.aliases?.some((alias) => lower(alias) === lower(value)),
  );
  if (aliases.length) return aliases.length === 1 ? aliases[0] : undefined;
  const nameMatches = items.filter((item) => lower(item.name) === lower(value));
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

function mergeCompatibilities(
  first: CatalogCompatibility[],
  second: CatalogCompatibility[],
): CatalogCompatibility[] {
  const values = new Map<string, CatalogCompatibility>();
  for (const item of [...first, ...second]) {
    values.set(JSON.stringify([item.model_id, item.year_from, item.year_to, item.notes]), item);
  }
  const applications = [...values.values()];
  return applications.filter(
    (item) =>
      item.notes ||
      !applications.some(
        (other) =>
          other.model_id === item.model_id &&
          other.year_from === item.year_from &&
          other.year_to === item.year_to &&
          Boolean(other.notes),
      ),
  );
}

/** DB product fields are authoritative; existing explicit local applications are preserved. */
export function buildCatalogSnapshot(
  localProducts: CatalogSourceProduct[],
  databaseProducts: CatalogProduct[],
  databaseCategories: Category[],
  databaseModels: VehicleModel[],
  brands: Brand[] = [],
  suppressedLocalSkus: Iterable<string> = [],
): CatalogSnapshot {
  const categories = databaseCategories.map((item) => ({
    ...item,
    aliases: [...(item.aliases ?? [])],
  }));
  const models = databaseModels.map((item) => ({ ...item, aliases: [...(item.aliases ?? [])] }));
  const suppressed = new Set(suppressedLocalSkus);
  const productsBySku = new Map<string, CatalogProduct>();
  for (const product of localProducts) {
    if (!product.active || suppressed.has(product.sku)) continue;
    let category = product.category
      ? (findCatalogLookup(categories, product.category.id) ??
        findCatalogLookup(categories, product.category.slug) ??
        (product.category.id.startsWith("subcat-")
          ? findCatalogLookup(categories, product.category.name)
          : undefined))
      : undefined;
    if (!category && product.category) {
      category = {
        ...product.category,
        description: null,
        created_at: product.created_at,
        sort_order: 1000 + categories.length,
        aliases: [],
      };
      categories.push(category);
    }
    if (category && product.category) {
      category.aliases = [
        ...new Set([...category.aliases, product.category.id, product.category.slug]),
      ];
    }
    const compat: CatalogCompatibility[] = product.compat.map((application) => {
      let model =
        findCatalogLookup(models, application.model_id) ??
        findCatalogLookup(models, application.model_slug) ??
        (!application.model_id ? findCatalogLookup(models, application.model) : undefined);
      if (!model) {
        model = {
          id: application.model_id ?? `model-${application.model_slug}`,
          name: application.model,
          slug: application.model_slug,
          sort_order: 1000 + models.length,
          aliases: [],
        };
        models.push(model);
      }
      model.aliases = [
        ...new Set([
          ...model.aliases,
          application.model_id ?? `model-${application.model_slug}`,
          application.model_slug,
        ]),
      ];
      return { ...application, model_id: model.id, model: model.name, model_slug: model.slug };
    });
    productsBySku.set(product.sku, {
      ...product,
      category_id: category?.id ?? null,
      category: category ?? null,
      compat: mergeCompatibilities([], compat),
    });
  }
  for (const product of databaseProducts) {
    if (!product.active) {
      productsBySku.delete(product.sku);
      continue;
    }
    const local = productsBySku.get(product.sku);
    productsBySku.set(product.sku, {
      ...product,
      compat: mergeCompatibilities(local?.compat ?? [], product.compat),
    });
  }
  const products = [...productsBySku.values()];
  const facets: CatalogFacet[] = products.flatMap<CatalogFacet>((product) =>
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
  const counts = new Map<string, { modelId: string; categoryId: string; products: Set<string> }>();
  for (const facet of facets) {
    if (!facet.modelId || !facet.categoryId) continue;
    const key = JSON.stringify([facet.modelId, facet.categoryId]);
    const group = counts.get(key) ?? {
      modelId: facet.modelId,
      categoryId: facet.categoryId,
      products: new Set<string>(),
    };
    group.products.add(facet.productId);
    counts.set(key, group);
  }
  const byOrder = (
    a: { sort_order: number; name: string },
    b: { sort_order: number; name: string },
  ) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es");
  return {
    products,
    meta: {
      categories: categories.sort(byOrder),
      models: models.sort(byOrder),
      brands,
      facets,
      modelCategories: [...counts.values()].map(({ modelId, categoryId, products: matches }) => ({
        modelId,
        categoryId,
        count: matches.size,
      })),
    },
  };
}

/** The model and year must match the same application, not two different vehicles. */
export function filterCatalogProducts(
  snapshot: CatalogSnapshot,
  query: CatalogQuery,
): CatalogProduct[] {
  const modelValue = query.ModelID ?? query.modelId ?? query.modelo;
  const categoryValue = query.CategoryID ?? query.categoryId ?? query.categoria;
  const model = findCatalogLookup(snapshot.meta.models, modelValue);
  const category = findCatalogLookup(snapshot.meta.categories, categoryValue);
  const legacyFilters = !query.CategoryID && !query.categoryId && query.categoria === "filtros";
  const legacyFilterCategories = new Set(
    snapshot.meta.categories
      .filter((item) =>
        [item.slug, ...(item.aliases ?? [])].some(
          (slug) =>
            slug === "filtros" || FILTER_SUBCATEGORY_SLUGS.some((legacy) => legacy === slug),
        ),
      )
      .map((item) => item.id),
  );
  if ((modelValue && !model) || (categoryValue && !category && !legacyFilters)) return [];
  const queryText = searchText(query.q ?? "");
  const terms = queryText.split(/\s+/).filter(Boolean);
  const compactCode = queryText.replace(/[^a-z0-9]/g, "");
  const categoryOrder = new Map(snapshot.meta.categories.map((item) => [item.id, item.sort_order]));
  return snapshot.products
    .filter((product) => {
      if (!product.active) return false;
      if (categoryValue) {
        const isLegacyFilter =
          legacyFilters && legacyFilterCategories.has(product.category_id ?? "");
        if (!isLegacyFilter && product.category_id !== category?.id) return false;
      }
      if (query.marca && product.brand?.slug !== query.marca && product.brand_id !== query.marca)
        return false;
      if (model || query.anio !== undefined) {
        const matchesApplication = product.compat.some(
          (application) =>
            (!model || application.model_id === model.id) &&
            (query.anio === undefined ||
              (query.anio >= application.year_from && query.anio <= application.year_to)),
        );
        if (!matchesApplication) return false;
      }
      if (terms.length) {
        const haystack = searchText(
          [
            product.name,
            product.sku,
            product.honda_code ?? "",
            product.description ?? "",
            ...product.compat.map((application) => application.model),
          ].join(" "),
        );
        const matchesText = terms.every((term) => haystack.includes(term));
        const matchesCode =
          compactCode &&
          [product.sku, product.honda_code ?? ""].some((code) =>
            searchText(code)
              .replace(/[^a-z0-9]/g, "")
              .includes(compactCode),
          );
        if (!matchesText && !matchesCode) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        Number(a.is_demo) - Number(b.is_demo) ||
        (categoryOrder.get(a.category_id ?? "") ?? 0) -
          (categoryOrder.get(b.category_id ?? "") ?? 0) ||
        a.name.localeCompare(b.name, "es") ||
        a.sku.localeCompare(b.sku, "es"),
    );
}

export function validateCatalogQuery(input: CatalogQuery): CatalogQuery {
  const value = input ?? {};
  const text = (item: unknown, length = 120) =>
    typeof item === "string" && item.trim() ? item.trim().slice(0, length) : undefined;
  return {
    ModelID: text(value.ModelID ?? value.modelId),
    CategoryID: text(value.CategoryID ?? value.categoryId),
    q: text(value.q, 80),
    modelo: text(value.modelo),
    categoria: text(value.categoria),
    marca: text(value.marca),
    anio:
      typeof value.anio === "number" &&
      Number.isInteger(value.anio) &&
      value.anio >= 1970 &&
      value.anio <= 2100
        ? value.anio
        : undefined,
  };
}
