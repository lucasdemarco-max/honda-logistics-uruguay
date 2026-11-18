import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PackageSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/site/PageHeader";
import { SearchBox } from "@/components/site/SearchBox";
import { ProductCard } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { DemoNotice } from "@/components/site/DemoNotice";
import { searchCatalog, type CatalogQuery } from "@/lib/public.functions";
import { catalogMetaQuery } from "./index";
import { cn } from "@/lib/utils";

interface CatalogSearch {
  q?: string | undefined;
  categoria?: string | undefined;
  modelo?: string | undefined;
  anio?: number | undefined;
  marca?: string | undefined;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);

const catalogQuery = (s: CatalogQuery) =>
  queryOptions({ queryKey: ["catalog", s], queryFn: () => searchCatalog({ data: s }), staleTime: 60_000 });

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1995 + 1 }, (_, i) => CURRENT_YEAR + 1 - i);
const ALL = "__all";

export const Route = createFileRoute("/catalogo")({
  validateSearch: (s: Record<string, unknown>): CatalogSearch => {
    const anio = Number(s["anio"]);
    return {
      q: str(s["q"]),
      categoria: str(s["categoria"]),
      modelo: str(s["modelo"]),
      anio: Number.isInteger(anio) && anio > 1970 && anio < 2100 ? anio : undefined,
      marca: str(s["marca"]),
    };
  },
  head: () => ({
    meta: [
      { title: "Catálogo de repuestos Honda — Honda Logistics" },
      { name: "description", content: "Filtros, correas, frenos, encendido, suspensión y motor para Civic, Fit, City, HR-V, CR-V y más. Precios en UYU." },
      { property: "og:title", content: "Catálogo de repuestos Honda — Honda Logistics" },
      { property: "og:description", content: "Buscá repuestos por nombre, código o modelo y año. Precios en pesos uruguayos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogMetaQuery),
      context.queryClient.ensureQueryData(catalogQuery(deps)),
    ]);
  },
  component: Catalogo,
});

function Catalogo() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const { data: meta } = useSuspenseQuery(catalogMetaQuery);
  const { data: products, isLoading, isError } = useQuery({ ...catalogQuery(search), placeholderData: keepPreviousData });

  const set = (patch: Partial<CatalogSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const hasFilters = !!(search.q || search.categoria || search.modelo || search.anio || search.marca);
  const activeModel = meta.models.find((m) => m.slug === search.modelo);

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Repuestos Honda"
        description="La compatibilidad de cada repuesto se carga explícitamente por modelo y año. Si tu vehículo no aparece, consultanos con tu número de chasis."
      >
        <div className="max-w-2xl">
          <SearchBox key={search.q ?? ""} initial={search.q ?? ""} />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
          <button
            type="button"
            onClick={() => set({ categoria: undefined })}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              !search.categoria ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
            )}
            aria-pressed={!search.categoria}
          >
            Todas
          </button>
          {meta.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set({ categoria: c.slug })}
              aria-pressed={search.categoria === c.slug}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                search.categoria === c.slug ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="f-modelo">Modelo</label>
            <Select value={search.modelo ?? ALL} onValueChange={(v) => set({ modelo: v === ALL ? undefined : v })}>
              <SelectTrigger id="f-modelo" className="bg-card"><SelectValue placeholder="Todos los modelos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los modelos</SelectItem>
                {meta.models.map((m) => <SelectItem key={m.id} value={m.slug}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="f-anio">Año</label>
            <Select value={search.anio ? String(search.anio) : ALL} onValueChange={(v) => set({ anio: v === ALL ? undefined : Number(v) })}>
              <SelectTrigger id="f-anio" className="bg-card"><SelectValue placeholder="Todos los años" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los años</SelectItem>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {hasFilters && (
              <Button variant="ghost" onClick={() => navigate({ search: {} })}>
                <X /> Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        <DemoNotice className="mt-6" />

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isLoading ? "Buscando…" : `${products?.length ?? 0} resultado${products?.length === 1 ? "" : "s"}`}
            {activeModel && ` para ${activeModel.name}`}
            {search.anio && ` ${search.anio}`}
            {search.q && ` · “${search.q}”`}
          </p>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[460px] rounded-lg" />)}
            </div>
          ) : isError ? (
            <EmptyState icon={PackageSearch} title="No pudimos cargar el catálogo" description="Probá de nuevo en unos minutos." />
          ) : !products || products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No encontramos repuestos con esos filtros"
              description="Puede que la aplicación todavía no esté cargada. Pedí un presupuesto con tu número de chasis y lo buscamos por vos."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => navigate({ search: {} })}>Ver todo el catálogo</Button>
                  <Button asChild><Link to="/presupuestos">Pedir presupuesto</Link></Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
