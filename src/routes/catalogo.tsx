import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CarFront, PackageSearch, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/site/PageHeader";
import { SearchBox } from "@/components/site/SearchBox";
import { ProductCard } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { DemoNotice } from "@/components/site/DemoNotice";
import { searchCatalog, type CatalogQuery } from "@/lib/public.functions";
import {
  categoriesForModel,
  catalogCategoryCounts,
  resolveNavigationLookup,
  selectCatalogCategory,
  selectCatalogModel,
  validateCatalogSearch,
  type CatalogNavigationState,
} from "@/lib/catalog-navigation";
import { catalogMetaQuery } from "./index";
import { cn } from "@/lib/utils";

const catalogQuery = (search: CatalogQuery) =>
  queryOptions({
    queryKey: ["catalog", search],
    queryFn: () => searchCatalog({ data: search }),
    staleTime: 60_000,
  });

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR + 2 - 1970 },
  (_, index) => CURRENT_YEAR + 1 - index,
);
const ALL = "__all";

export const Route = createFileRoute("/catalogo")({
  validateSearch: validateCatalogSearch,
  head: () => ({
    meta: [
      { title: "Catálogo de repuestos Honda — Honda Logistics" },
      {
        name: "description",
        content:
          "Elegí tu modelo Honda y explorá las categorías de repuestos con aplicaciones cargadas. Filtrá por año o buscá por código. Precios en UYU.",
      },
      { property: "og:title", content: "Catálogo de repuestos Honda — Honda Logistics" },
      {
        property: "og:description",
        content: "Repuestos por modelo, categoría y año. Precios en pesos uruguayos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogMetaQuery),
      context.queryClient.prefetchQuery(catalogQuery(deps)),
    ]);
  },
  component: Catalogo,
});

function Catalogo() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const { data: meta } = useSuspenseQuery(catalogMetaQuery);
  const {
    data: products,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    ...catalogQuery(search),
  });

  const set = (patch: Partial<CatalogNavigationState>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }) });
  const activeModel = resolveNavigationLookup(meta.models, search.modelId, search.modelo);
  const activeCategory = resolveNavigationLookup(
    meta.categories,
    search.categoryId,
    search.categoria,
  );
  // Existing shared links used "filtros" as a group including its subcategories.
  const legacyFilterGroup = !search.categoryId && search.categoria === "filtros";
  const availableCategories = categoriesForModel(
    meta.categories,
    meta.facets,
    activeModel?.id,
    search.anio,
  );
  const hasFilters = Boolean(
    search.q ||
    search.categoryId ||
    search.modelId ||
    search.categoria ||
    search.modelo ||
    search.anio ||
    search.marca,
  );
  const hasModelSelection = Boolean(search.modelId || search.modelo);
  const hasCategorySelection = Boolean(search.categoryId || search.categoria);
  const changingResults = isLoading;
  const selectModel = (modelId: string | undefined) =>
    void navigate({
      search: (previous) => selectCatalogModel(previous, modelId),
    });
  const selectCategory = (categoryId: string | undefined) =>
    void navigate({
      search: (previous) => ({
        ...selectCatalogCategory(previous, categoryId),
        ...(activeModel ? { modelId: activeModel.id, modelo: undefined } : {}),
      }),
    });
  const categoryCounts = catalogCategoryCounts(meta.facets, activeModel?.id, search.anio);

  return (
    <>
      <PageHeader
        eyebrow="Catálogo de repuestos"
        title="Empezá por tu Honda"
        description="Elegí el modelo, explorá sus categorías y ajustá por año. Cada compatibilidad corresponde a una aplicación cargada; si tenés dudas, consultanos con tu número de chasis."
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="catalog-model-heading"
          className="rounded-xl border bg-card p-5 shadow-card sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-primary">1 · Modelo</p>
              <h2 id="catalog-model-heading" className="mt-1 text-2xl font-semibold uppercase">
                {activeModel ? `Honda ${activeModel.name}` : "Elegí el modelo de tu Honda"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeModel
                  ? "Repuestos con aplicaciones cargadas para este modelo."
                  : "Encontrá las categorías disponibles para cada vehículo."}
              </p>
            </div>
            {activeModel && (
              <Button variant="outline" onClick={() => selectModel(undefined)}>
                Cambiar modelo
              </Button>
            )}
          </div>
          {hasModelSelection && !activeModel && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              El modelo del enlace no está disponible. Elegí uno de los modelos del catálogo.
            </p>
          )}
          {!activeModel ? (
            <div
              className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              role="group"
              aria-label="Modelos Honda"
            >
              {meta.models.map((model) => {
                const categoryCount = categoriesForModel(
                  meta.categories,
                  meta.facets,
                  model.id,
                ).length;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => selectModel(model.id)}
                    className="group flex min-h-28 flex-col items-start rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <CarFront className="mb-2 h-5 w-5 text-primary" aria-hidden />
                    <span className="font-display text-xl font-semibold uppercase group-hover:text-primary">
                      {model.name}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {categoryCount > 0
                        ? `${categoryCount} categoría${categoryCount === 1 ? "" : "s"}`
                        : "Consultar aplicaciones"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="catalog-model" className="mb-1 block text-sm font-medium">
                  Modelo seleccionado
                </label>
                <Select value={activeModel.id} onValueChange={selectModel}>
                  <SelectTrigger id="catalog-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="catalog-year" className="mb-1 block text-sm font-medium">
                  Año del vehículo (opcional)
                </label>
                <Select
                  value={search.anio ? String(search.anio) : ALL}
                  onValueChange={(value) =>
                    set({ anio: value === ALL ? undefined : Number(value) })
                  }
                >
                  <SelectTrigger id="catalog-year">
                    <SelectValue placeholder="Todos los años" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos los años</SelectItem>
                    {[...new Set([...(search.anio ? [search.anio] : []), ...YEARS])]
                      .sort((a, b) => b - a)
                      .map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {meta.models.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Todavía no hay modelos con aplicaciones cargadas. Podés explorar los productos o pedir
              un presupuesto.
            </p>
          )}
        </section>

        <section aria-labelledby="catalog-category-heading" className="mt-7">
          <p className="eyebrow text-primary">2 · Categoría</p>
          <h2 id="catalog-category-heading" className="mt-1 text-2xl font-semibold uppercase">
            {activeModel ? `Repuestos para ${activeModel.name}` : "Explorá las categorías"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeModel
              ? "Estas categorías tienen productos con aplicaciones para el modelo y año seleccionados."
              : "Seleccioná un modelo arriba para ver las categorías de tu vehículo, o explorá el catálogo completo."}
          </p>
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Categorías disponibles"
          >
            <button
              type="button"
              onClick={() => selectCategory(undefined)}
              aria-pressed={!hasCategorySelection}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                !hasCategorySelection
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary",
              )}
            >
              Todos los repuestos
            </button>
            {legacyFilterGroup && (
              <button
                type="button"
                onClick={() => selectCategory(undefined)}
                aria-pressed="true"
                aria-label="Todos los filtros; quitar selección"
                className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Todos los filtros <X className="h-3 w-3" aria-hidden />
              </button>
            )}
            {availableCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => selectCategory(category.id)}
                aria-pressed={!legacyFilterGroup && activeCategory?.id === category.id}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  !legacyFilterGroup && activeCategory?.id === category.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-primary",
                )}
              >
                {category.name}
                {activeModel && (
                  <span className="ml-2 text-xs opacity-75">{categoryCounts.get(category.id)}</span>
                )}
              </button>
            ))}
          </div>
          {activeModel && availableCategories.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Todavía no hay categorías con repuestos para este modelo. Consultanos por la
              aplicación que necesitás.
            </p>
          )}
          {hasCategorySelection &&
            !legacyFilterGroup &&
            (!activeCategory ||
              !availableCategories.some((category) => category.id === activeCategory.id)) && (
              <div
                role="status"
                className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
              >
                <span>La categoría del enlace no tiene aplicaciones para esta selección.</span>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => selectCategory(undefined)}
                >
                  Ver otras categorías
                </Button>
              </div>
            )}
        </section>

        <details
          className="mt-6 rounded-lg border bg-card p-4"
          open={Boolean(search.q) || undefined}
        >
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" aria-hidden /> ¿Tenés el código? Buscá por
            código Honda, SKU o nombre
          </summary>
          <div className="mt-3 max-w-2xl">
            <SearchBox key={search.q ?? ""} initial={search.q ?? ""} onSearch={(q) => set({ q })} />
            <p className="mt-2 text-xs text-muted-foreground">
              La búsqueda conserva el modelo, la categoría y el año seleccionados.
            </p>
          </div>
        </details>

        {products?.some((product) => product.is_demo) && <DemoNotice className="mt-6" />}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {changingResults
              ? "Buscando…"
              : `${products?.length ?? 0} resultado${products?.length === 1 ? "" : "s"}`}
            {activeModel && ` para ${activeModel.name}`}
            {search.anio && ` ${search.anio}`}
            {legacyFilterGroup
              ? " · Todos los filtros"
              : activeCategory && ` · ${activeCategory.name}`}
            {search.q && ` · “${search.q}”`}
            {isFetching && !changingResults && " · Actualizando…"}
          </p>
          {hasFilters && (
            <Button variant="ghost" onClick={() => void navigate({ search: {} })}>
              <X /> Limpiar filtros
            </Button>
          )}
        </div>

        <section className="mt-4" aria-labelledby="catalog-products-heading" aria-busy={isFetching}>
          <h2 id="catalog-products-heading" className="sr-only">
            3 · Repuestos disponibles
          </h2>
          {changingResults ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-[460px] rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              icon={PackageSearch}
              title="No pudimos cargar el catálogo"
              description="Intentá cargar los productos nuevamente."
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : !products || products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No encontramos repuestos con esta selección"
              description="Puede que la aplicación todavía no esté cargada. Pedí un presupuesto con tu número de chasis y lo buscamos por vos."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => void navigate({ search: {} })}>
                    Ver todo el catálogo
                  </Button>
                  <Button asChild>
                    <Link to="/presupuestos">
                      Pedir presupuesto <ArrowRight />
                    </Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
