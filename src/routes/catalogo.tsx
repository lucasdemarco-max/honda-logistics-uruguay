import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { BatteryCharging, CarFront, PackageSearch, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { DemoNotice } from "@/components/site/DemoNotice";
import { searchCatalog, type CatalogQuery, type CatalogProduct } from "@/lib/public.functions";
import { catalogMetaQuery } from "./index";

interface CatalogSearch {
  modelo?: string | undefined;
  categoria?: string | undefined;
  anio?: number | undefined;
  q?: string | undefined;
  marca?: string | undefined;
}
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;
const MODELS_WITH_PHOTOS = new Set([
  "accord", "city", "civic", "cr-v", "fit", "hr-v",
  "odyssey", "pilot", "ridgeline", "type-r", "wr-v", "zr-v",
]);
const CATEGORY_IMAGE_KEYS = new Set([
  "correas", "encendido", "filtros", "frenos", "motor", "otros", "suspension",
]);
const catalogQuery = (query: CatalogQuery) => queryOptions({
  queryKey: ["catalog-by-model", query],
  queryFn: () => searchCatalog({ data: query }),
  staleTime: 60_000,
});

function productCategory(product: CatalogProduct) {
  const category = product.category;
  if (!category) return { slug: "otros", name: "Otros repuestos", imageKey: "otros" };
  if (category.slug === "filtros" || category.slug.startsWith("filtros-")) {
    return { slug: "filtros", name: "Filtros", imageKey: "filtros" };
  }
  const imageKey = category.image_key ?? category.slug;
  return {
    slug: category.slug,
    name: category.name,
    imageKey: CATEGORY_IMAGE_KEYS.has(imageKey) ? imageKey : "otros",
  };
}

export const Route = createFileRoute("/catalogo")({
  validateSearch: (s: Record<string, unknown>): CatalogSearch => {
    return {
      modelo: asText(s["modelo"]),
      categoria: asText(s["categoria"]),
      anio: Number.isInteger(Number(s["anio"])) && Number(s["anio"]) >= 1970 && Number(s["anio"]) <= 2100 ? Number(s["anio"]) : undefined,
      q: asText(s["q"]),
      marca: asText(s["marca"]),
    };
  },
  head: () => ({
    meta: [
      { title: "Repuestos por modelo Honda — Honda Logistics Uruguay" },
      { name: "description", content: "Seleccioná tu modelo Honda y explorá filtros, correas, fluidos y más repuestos por categoría." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogMetaQuery),
  component: Catalogo,
});

function Catalogo() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const { data: meta } = useSuspenseQuery(catalogMetaQuery);
  const models = meta.models.filter((model) => model.slug !== "otros");
  const selectedModel = models.find((model) => model.slug === search.modelo);
  // Fetch all products for the chosen model, then derive categories from products that actually exist.
  // No database schema changes are needed when importing additional categories.
  const query = catalogQuery({ modelo: selectedModel?.slug, q: search.q, marca: search.marca });
  const { data: results = [], isLoading, isError } = useQuery({ ...query, enabled: !!selectedModel });
  const modelProducts = results.filter((product) =>
    product.compat.some((application) => application.model_slug === selectedModel?.slug),
  );
  const years = [...new Set(modelProducts.flatMap((product) =>
    product.compat.filter((c) => c.model_slug === selectedModel?.slug)
      .flatMap((c) => Array.from({ length: Math.max(0, c.year_to - c.year_from + 1) }, (_, i) => c.year_from + i)),
  ))].sort((a, b) => b - a);
  const products = modelProducts.filter((product) =>
    !search.anio || product.compat.some((c) =>
      c.model_slug === selectedModel?.slug && search.anio! >= c.year_from && search.anio! <= c.year_to),
  );
  const categories = Array.from(
    new Map(products.map((product) => {
      const category = productCategory(product);
      return [category.slug, category] as const;
    })).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const categorySelected = search.categoria && categories.some((category) => category.slug === search.categoria)
    ? search.categoria : undefined;
  const displayedProducts = categorySelected
    ? products.filter((product) => productCategory(product).slug === categorySelected)
    : products;
  const set = (patch: Partial<CatalogSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }) });

  return (
    <>
      <PageHeader
        eyebrow="Catálogo Honda Logistics"
        title="Encontrá los repuestos para tu Honda"
        description="Primero elegí el modelo. Después seleccioná una categoría para encontrar los repuestos asociados. Confirmá siempre la aplicación definitiva con el chasis."
      />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <section aria-labelledby="modelo-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Paso 1</p>
              <h2 id="modelo-heading" className="text-2xl font-bold">Seleccioná tu modelo Honda</h2>
            </div>
            {selectedModel && <Button variant="ghost" onClick={() => navigate({ search: {} })}><X /> Cambiar modelo</Button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {models.map((model) => (
              <button
                key={model.slug}
                type="button"
                aria-pressed={search.modelo === model.slug}
                onClick={() => set({ modelo: model.slug, categoria: undefined, anio: undefined, q: undefined, marca: undefined })}
                className={`flex min-w-0 flex-col items-center overflow-hidden rounded-lg border bg-white text-center transition-colors hover:border-primary ${search.modelo === model.slug ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <span className="flex aspect-[12/5] w-full items-center justify-center px-2">
                  {MODELS_WITH_PHOTOS.has(model.slug) ? (
                    <img
                      src={`/images/models/${model.slug}.webp`}
                      alt=""
                      width={480}
                      height={200}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <CarFront className="size-8 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className={`w-full px-2 py-2.5 font-semibold ${search.modelo === model.slug ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                  {model.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {selectedModel && (
          <>
            <section aria-labelledby="categoria-heading">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase text-primary">Paso 2</p>
                <h2 id="categoria-heading" className="text-2xl font-bold">Categorías para {selectedModel.name}</h2>
                <p className="text-sm text-muted-foreground">Si tu repuesto no está dentro de estas categorías, comunicate con nosotros para un presupuesto.</p>
                <div className="mt-4 max-w-64">
                  <label htmlFor="catalog-year" className="mb-1 block text-sm font-medium">Año del vehículo</label>
                  <Select value={search.anio ? String(search.anio) : "__all"} onValueChange={(value) => set({ anio: value === "__all" ? undefined : Number(value), categoria: undefined })}>
                    <SelectTrigger id="catalog-year"><SelectValue placeholder="Todos los años" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todos los años</SelectItem>
                      {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
                : isError ? <EmptyState icon={PackageSearch} title="No pudimos cargar las categorías" description="Reintentá la consulta más tarde." />
                : categories.length === 0 ? <EmptyState icon={PackageSearch} title="Sin repuestos cargados para este modelo" description="Podés consultarnos con el número de chasis." />
                : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {categories.map((category) => (
                      <button
                        key={category.slug}
                        type="button"
                        aria-pressed={categorySelected === category.slug}
                        onClick={() => set({ categoria: category.slug })}
                        className={`flex min-h-16 w-full items-center gap-2 rounded-lg border p-2 text-left text-sm font-semibold transition-colors hover:border-primary sm:gap-3 sm:px-3 sm:text-base ${categorySelected === category.slug ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
                      >
                        {category.slug === "baterias" ? (
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground sm:size-12">
                            <BatteryCharging className="size-6" aria-hidden />
                          </span>
                        ) : (
                          <img
                            src={`/images/categories/${category.imageKey}.jpg`}
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
                            className="size-10 shrink-0 rounded-md object-cover sm:size-12"
                          />
                        )}
                        <span className="min-w-0 break-words">{category.name}</span>
                      </button>
                    ))}
                  </div>
                )}
            </section>
            {categorySelected && (
              <section aria-labelledby="productos-heading">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary">Paso 3</p>
                    <h2 id="productos-heading" className="text-2xl font-bold">{categories.find((category) => category.slug === categorySelected)?.name} · {selectedModel.name}</h2>
                    <p className="text-sm text-muted-foreground">{displayedProducts.length} repuestos encontrados{search.anio ? ` · Año ${search.anio}` : ""}.</p>
                  </div>
                  <Button variant="outline" onClick={() => set({ categoria: undefined })}>Cambiar categoría</Button>
                </div>
                <DemoNotice className="mb-5" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} modelSlug={selectedModel.slug} />
                  ))}
                </div>
                <p className="mt-6 text-sm text-muted-foreground">La asociación por modelo y año es orientativa. Antes de confirmar el repuesto verificamos la aplicación con el VIN.</p>
              </section>
            )}
            {!categorySelected && categories.length > 0 && (
              <p className="rounded-lg border bg-muted/50 p-5 text-sm text-muted-foreground">Elegí una categoría para ver los repuestos correspondientes.</p>
            )}
          </>
        )}
        {!selectedModel && (
          <div className="rounded-lg border bg-muted/50 p-6 text-center">
            <p className="text-muted-foreground">Seleccioná un modelo para comenzar.</p>
            <Button asChild variant="link"><Link to="/presupuestos">¿No encontrás tu vehículo? Consultanos por chasis.</Link></Button>
          </div>
        )}
      </div>
    </>
  );
}
