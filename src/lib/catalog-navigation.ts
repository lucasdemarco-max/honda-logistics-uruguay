export interface CatalogNavigationState {
  q?: string | undefined;
  modelId?: string | undefined;
  categoryId?: string | undefined;
  modelo?: string | undefined;
  categoria?: string | undefined;
  anio?: number | undefined;
  marca?: string | undefined;
}

export interface NavigationLookup {
  id: string;
  name: string;
  slug: string;
  aliases?: string[];
}

export interface NavigationFacet {
  productId: string;
  categoryId: string | null;
  modelId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

const queryText = (value: unknown, maxLength = 120) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;

export function validateCatalogSearch(search: Record<string, unknown>): CatalogNavigationState {
  const year = Number(search["anio"]);
  return {
    q: queryText(search["q"], 80),
    modelId: queryText(search["modelId"]) ?? queryText(search["ModelID"]),
    categoryId: queryText(search["categoryId"]) ?? queryText(search["CategoryID"]),
    modelo: queryText(search["modelo"]),
    categoria: queryText(search["categoria"]),
    anio: Number.isInteger(year) && year >= 1970 && year <= 2100 ? year : undefined,
    marca: queryText(search["marca"]),
  };
}

export function resolveNavigationLookup<T extends NavigationLookup>(
  items: T[],
  id: string | undefined,
  legacyValue?: string | undefined,
): T | undefined {
  const value = id || legacyValue;
  if (!value) return undefined;
  const exact = items.find((item) => item.id === value);
  if (exact) return exact;
  const normalized = value.trim().toLocaleLowerCase("es");
  const slugMatches = items.filter((item) => item.slug.toLocaleLowerCase("es") === normalized);
  if (slugMatches.length > 0) return slugMatches.length === 1 ? slugMatches[0] : undefined;
  const aliasMatches = items.filter((item) =>
    item.aliases?.some((alias) => alias.toLocaleLowerCase("es") === normalized),
  );
  if (aliasMatches.length > 0) return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
  const nameMatches = items.filter((item) => item.name.toLocaleLowerCase("es") === normalized);
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

export function catalogCategoryCounts(
  facets: NavigationFacet[],
  modelId?: string | undefined,
  year?: number | undefined,
): Map<string, number> {
  const productsByCategory = new Map<string, Set<string>>();
  for (const facet of facets) {
    if (facet.categoryId === null) continue;
    if (modelId && facet.modelId !== modelId) continue;
    if (
      year !== undefined &&
      (facet.yearFrom === null ||
        facet.yearTo === null ||
        year < facet.yearFrom ||
        year > facet.yearTo)
    )
      continue;
    const products = productsByCategory.get(facet.categoryId) ?? new Set<string>();
    products.add(facet.productId);
    productsByCategory.set(facet.categoryId, products);
  }
  return new Map(
    [...productsByCategory].map(([categoryId, products]) => [categoryId, products.size]),
  );
}

export function categoriesForModel<T extends NavigationLookup>(
  categories: T[],
  facets: NavigationFacet[],
  modelId?: string | undefined,
  year?: number | undefined,
): T[] {
  const counts = catalogCategoryCounts(facets, modelId, year);
  return categories.filter((category) => (counts.get(category.id) ?? 0) > 0);
}

export function selectCatalogModel(
  previous: CatalogNavigationState,
  modelId: string | undefined,
): CatalogNavigationState {
  return {
    ...previous,
    modelId,
    modelo: undefined,
    categoryId: undefined,
    categoria: undefined,
    anio: undefined,
  };
}

export function selectCatalogCategory(
  previous: CatalogNavigationState,
  categoryId: string | undefined,
): CatalogNavigationState {
  return { ...previous, categoryId, categoria: undefined };
}
