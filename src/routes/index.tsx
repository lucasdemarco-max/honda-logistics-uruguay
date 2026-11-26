import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CarFront,
  Search,
  ClipboardList,
  FileText,
  PackageSearch,
  ShieldCheck,
  Truck,
  Landmark,
  Award,
} from "lucide-react";
import heroImg from "@/assets/hero-parts.jpg";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/site/SearchBox";
import { getCatalogMeta } from "@/lib/public.functions";
import { categoriesForModel } from "@/lib/catalog-navigation";

export const catalogMetaQuery = queryOptions({
  queryKey: ["catalog-meta"],
  queryFn: () => getCatalogMeta(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Honda Logistics — Repuestos para Honda Automóviles en Uruguay" },
      {
        name: "description",
        content:
          "Catálogo de repuestos Honda, seguimiento de casos por repuesto y presupuestos por número de chasis. Envíos a todo Uruguay.",
      },
      { property: "og:title", content: "Honda Logistics — Repuestos Honda en Uruguay" },
      {
        property: "og:description",
        content: "Catálogo, seguimiento de casos y presupuestos por chasis. Envíos a todo Uruguay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogMetaQuery),
  component: Index,
});

const SERVICES = [
  {
    icon: PackageSearch,
    title: "Catálogo de repuestos",
    text: "Elegí tu Honda y explorá sus categorías de repuestos. Ajustá la selección por año.",
    to: "/catalogo" as const,
    cta: "Ver catálogo",
  },
  {
    icon: ClipboardList,
    title: "Seguimiento de casos",
    text: "Cada repuesto de tu caso con su propio estado: desde fábrica hasta la entrega.",
    to: "/seguimiento" as const,
    cta: "Cómo funciona",
  },
  {
    icon: FileText,
    title: "Presupuestos por chasis",
    text: "Consultá en tu perfil los presupuestos asociados al VIN de tu vehículo.",
    to: "/presupuestos" as const,
    cta: "Ver presupuestos",
  },
  {
    icon: Award,
    title: "Marcas Asociadas",
    text: "Neumáticos, baterías, lubricantes y accesorios, con su relación con Honda claramente indicada.",
    to: "/marcas" as const,
    cta: "Ver marcas",
  },
];

function Index() {
  const { data } = useSuspenseQuery(catalogMetaQuery);
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="bg-hero-overlay absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-12 sm:px-6 md:pb-24 md:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="eyebrow text-primary">Repuestos · Honda Automóviles · Uruguay</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-bold uppercase leading-[0.95] md:text-6xl">
              Tu Honda.
              <br />
              <span className="text-primary">Sus repuestos.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-muted">
              Empezá por tu modelo para encontrar las categorías y repuestos con aplicaciones
              cargadas para tu vehículo.
            </p>
            <ol
              aria-label="Cómo explorar el catálogo"
              className="mt-7 flex flex-wrap items-center gap-3 text-sm"
            >
              <li className="rounded-full border border-white/25 px-3 py-1.5">1 · Modelo</li>
              <li className="rounded-full border border-white/25 px-3 py-1.5">2 · Categoría</li>
              <li className="rounded-full border border-white/25 px-3 py-1.5">3 · Repuestos</li>
            </ol>
            <p className="mt-5 max-w-lg text-sm text-ink-muted">
              Podés precisar la aplicación por año. Para confirmar el repuesto de tu unidad,
              consultanos con tu número de chasis.
            </p>
          </div>
          <div
            className="rounded-xl border border-white/20 bg-ink/90 p-5 shadow-lift sm:p-6"
            aria-labelledby="home-model-heading"
          >
            <h2 id="home-model-heading" className="font-display text-2xl font-semibold uppercase">
              Elegí el modelo de tu Honda
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {data.models.map((model) => {
                const categoryCount = categoriesForModel(
                  data.categories,
                  data.facets,
                  model.id,
                ).length;
                return (
                  <Link
                    key={model.id}
                    to="/catalogo"
                    search={{ modelId: model.id }}
                    className="group flex min-h-24 flex-col rounded-lg border border-white/20 bg-white/5 p-3 transition-colors hover:border-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <CarFront className="h-5 w-5 text-primary" aria-hidden />
                      <ArrowRight
                        className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                    <span className="mt-2 font-display text-lg font-semibold uppercase">
                      {model.name}
                    </span>
                    <span className="mt-0.5 text-xs text-ink-muted">
                      {categoryCount} categoría{categoryCount === 1 ? "" : "s"}
                    </span>
                  </Link>
                );
              })}
            </div>
            {data.models.length === 0 && (
              <p className="mt-4 text-sm text-ink-muted">
                Todavía no hay modelos con aplicaciones cargadas. Podés explorar el catálogo general
                o pedir un presupuesto.
              </p>
            )}
            <Link
              to="/catalogo"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-primary"
            >
              Ver todo el catálogo <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label="Servicios Honda Logistics"
        className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <Link
              key={service.to}
              to={service.to}
              className="group flex flex-col rounded-lg border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <service.icon className="h-7 w-7 text-primary" aria-hidden />
              <h2 className="mt-4 text-2xl font-semibold uppercase">{service.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{service.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {service.cta}{" "}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8"
        aria-labelledby="home-categories-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-primary">Catálogo general</p>
            <h2
              id="home-categories-heading"
              className="red-rule mt-4 text-3xl font-bold uppercase md:text-4xl"
            >
              Todas las categorías disponibles
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Elegí tu modelo arriba para ver solo sus aplicaciones, o explorá por sistema.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/catalogo">
              Ver catálogo <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {data.categories.map((category) => (
            <Link
              key={category.id}
              to="/catalogo"
              search={{ categoryId: category.id }}
              className="group overflow-hidden rounded-lg border bg-card shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={`/images/categories/${category.image_key ?? "otros"}.jpg`}
                  alt=""
                  loading="lazy"
                  width={944}
                  height={704}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="border-t-2 border-transparent p-3 transition-colors group-hover:border-primary">
                <p className="font-display text-lg font-semibold uppercase">{category.name}</p>
              </div>
            </Link>
          ))}
        </div>
        {data.categories.length === 0 && (
          <p className="mt-5 text-sm text-muted-foreground">
            Todavía no hay categorías con productos publicados.
          </p>
        )}
        <details className="mt-7 rounded-lg border bg-card p-5">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" aria-hidden />
            ¿Ya tenés el código del repuesto?
          </summary>
          <div className="mt-4 max-w-2xl">
            <SearchBox />
          </div>
        </details>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border bg-card p-8 shadow-card md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-bold uppercase">
              ¿Tenés un caso o presupuesto con nosotros?
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Creá tu cuenta con tus datos y los de tu vehículo. Una vez validada, vas a ver el
              estado de cada repuesto y tus presupuestos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ modo: "registro" }}>
                Crear cuenta
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{}}>
                Ingresar
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
