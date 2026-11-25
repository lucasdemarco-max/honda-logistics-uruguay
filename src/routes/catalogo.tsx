import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CarFront, ChevronRight, PackageSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { DemoNotice } from "@/components/site/DemoNotice";
import { searchCatalog, type CatalogQuery, type CatalogProduct } from "@/lib/public.functions";
import { catalogMetaQuery } from "./index";

interface CatalogSearch {
  modelo?: string;
  categoria?: string;
  anio?: number;
  q?: string;
  marca?: string;
}
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;
const ALL = "__all";
const YEARS = Array.from({ length: new Date().getFullYear() - 1995 + 2 }, (_, i) => new Date().getFullYear() + 1 - i);
const catalogQuery = (query: CatalogQuery) => queryOptions({
  queryKey: ["catalog-by-model", query],
  queryFn: () => searchCatalog({ data: query }),
  staleTime: 60_000,
});

function productCategory(product: CatalogProduct) {
  const category = product.category;
  if (!category) return { slug: "otros", name: "Otros repuestos" };
  if (category.slug === "filtros" || category.slug.startsWith("filtros-")) {
    return { slug: "filtros", name: "Filtros" };
  }
  return { slug: category.slug, name: category.name };
}

export const Route = createFileRoute("/catalogo")({
  validateSearch: (s: Record<string, unknown>): CatalogSearch => {
    const year = Number(s["anio"]);
    return {
      modelo: asText(s["modelo"]),
      categoria: asText(s["categoria"]),
      q: asText(s["q"]),
      marca: asText(s["marca"]),
      anio: Number.isInteger(year) && year >= 1970 && year <= 2100 ? year : undefined,
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
  const selectedModel = meta.models.find((model) => model.slug === search.modelo);
  // Fetch all products for the chosen model, then derive categories from products that actually exist.
  // No database schema changes are needed when importing additional categories.
  const query = catalogQuery({ modelo: search.modelo, anio: search.anio, q: search.q, marca: search.marca });
  const { data: products = [], isLoading, isError } = useQuery({ ...query, enabled: !!selectedModel });
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
              <h2 id="modelo-heading" className="text-2xl font-bold uppercase">Seleccioná tu modelo Honda</h2>
            </div>
            {selectedModel && <Button variant="ghost" onClick={() => navigate({ search: {} })}><X /> Cambiar modelo</Button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {meta.models.map((model) => (
              <button
                key={model.slug}
                type="button"
                aria-pressed={search.modelo === model.slug}
                onClick={() => set({ modelo: model.slug, categoria: undefined, anio: undefined, q: undefined, marca: undefined })}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary hover:bg-primary/5 ${search.modelo === model.slug ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
              >
                <CarFront className="h-7 w-7" aria-hidden />
                <span className="font-semibold">{model.name}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedModel && (
          <>
            <section aria-labelledby="categoria-heading">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase text-primary">Paso 2</p>
                <h2 id="categoria-heading" className="text-2xl font-bold uppercase">Categorías para {selectedModel.name}</h2>
                <p className="text-sm text-muted-foreground">Solo aparecen las categorías con repuestos cargados para el modelo seleccionado.</p>
              </div>
              <div className="mb-5 max-w-52">
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground" htmlFor="anio-catalogo">Año (opcional)</label>
                <Select value={search.anio ? String(search.anio) : ALL} onValueChange={(value) => set({ anio: value === ALL ? undefined : Number(value), categoria: undefined })}>
                  <SelectTrigger id="anio-catalogo"><SelectValue placeholder="Todos los años" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos los años</SelectItem>
                    {YEARS.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
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
                        className={`flex items-center justify-between gap-2 rounded-lg border p-4 text-left font-semibold hover:border-primary ${categorySelected === category.slug ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
                      >
                        <span>{category.name}</span><ChevronRight className="h-4 w-4 shrink-0" />
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
                    <h2 id="productos-heading" className="text-2xl font-bold uppercase">{categories.find((category) => category.slug === categorySelected)?.name} · {selectedModel.name}</h2>
                    <p className="text-sm text-muted-foreground">{displayedProducts.length} repuestos encontrados{search.anio ? ` para ${search.anio}` : ""}.</p>
                  </div>
                  <Button variant="outline" onClick={() => set({ categoria: undefined })}>Cambiar categoría</Button>
                </div>
                <DemoNotice className="mb-5" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {displayedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
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
