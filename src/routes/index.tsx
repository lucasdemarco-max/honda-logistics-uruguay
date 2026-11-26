import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, ClipboardList, FileText, PackageSearch, ShieldCheck, Truck, Landmark, Award } from "lucide-react";
import heroImg from "@/assets/hero-parts.jpg";
import { Button } from "@/components/ui/button";
import { getCatalogMeta, getHomeProductTypes } from "@/lib/public.functions";

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
        content: "Catálogo de repuestos Honda, seguimiento de casos por repuesto y presupuestos por número de chasis. Envíos a todo Uruguay.",
      },
      { property: "og:title", content: "Honda Logistics — Repuestos Honda en Uruguay" },
      { property: "og:description", content: "Catálogo, seguimiento de casos y presupuestos por chasis. Envíos a todo Uruguay." },
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
    title: "Catálogo de repuestos por Modelo",
    text: "Elegí tu modelo Honda y explorá sus repuestos agrupados por categoría.",
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
  const { data: productTypes = [], isLoading: loadingTypes, isError: productTypesError } = useQuery({
    queryKey: ["home-product-types"],
    queryFn: () => getHomeProductTypes(),
    staleTime: 5 * 60_000,
  });
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
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 md:pb-28 md:pt-24 lg:px-8">
          <p className="eyebrow text-primary">Repuestos · Honda Automóviles · Uruguay</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold uppercase leading-[0.92] md:text-7xl">
            El repuesto correcto para tu Honda, <span className="text-primary">con seguimiento real.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted">
            Repuestos organizados por modelo y categoría, presupuestos por número de chasis y el estado de cada repuesto de
            tu pedido.
          </p>
          <div className="mt-8 max-w-2xl">
            <Button asChild size="lg"><Link to="/catalogo">Elegir modelo Honda <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex flex-col rounded-lg border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <s.icon className="h-7 w-7 text-primary" aria-hidden />
              <h2 className="mt-4 text-2xl font-semibold uppercase">{s.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {s.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="explora-tipos">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-primary">Categorías de repuestos</p>
            <h2 id="explora-tipos" className="red-rule mt-4 text-4xl font-bold uppercase">Explorá por tipo de producto</h2>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              Cada tipo reúne los códigos Honda disponibles. Abrí una categoría para consultar
              los modelos compatibles y los años de aplicación de cada código.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/catalogo">Catálogo por modelo <ArrowRight /></Link>
          </Button>
        </div>
        {loadingTypes ? (
          <div className="mt-8 rounded-lg border bg-card p-8 text-sm text-muted-foreground" role="status">
            Cargando tipos de producto…
          </div>
        ) : productTypesError ? (
          <div className="mt-8 rounded-lg border bg-card p-8 text-sm text-muted-foreground" role="alert">
            No se pudieron cargar los productos. Intentá nuevamente más tarde.
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {productTypes.map((category) => (
              <details key={category.slug} className="group overflow-hidden rounded-lg border bg-card shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 hover:bg-muted/40">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold uppercase">{category.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category.productCodes.length} códigos Honda
                    </p>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="max-h-[560px] space-y-3 overflow-y-auto border-t p-4">
                  {category.productCodes.map((part) => (
                    <div key={part.hondaCode} className="rounded-lg border bg-background p-3">
                      <p className="text-sm font-semibold">{part.name}</p>
                      <p className="mt-1 font-mono text-xs text-primary">Honda Code: {part.hondaCode}</p>
                      {part.models.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {part.models.map((application) => (
                            <li key={`${application.slug}-${application.yearFrom}-${application.yearTo}`}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span>{application.name} · {application.yearFrom === application.yearTo
                                ? application.yearFrom : `${application.yearFrom}–${application.yearTo}`}</span>
                              <Link
                                to="/catalogo"
                                search={{ modelo: application.slug, categoria: category.slug, q: part.hondaCode }}
                                className="font-medium text-primary hover:underline"
                              >Ver pieza</Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Aplicación por modelo pendiente de verificar.</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-xl bg-ink p-8 text-ink-foreground md:grid-cols-3 md:p-10">
          <div className="flex gap-4">
            <Truck className="h-8 w-8 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-xl font-semibold uppercase">Envíos en Uruguay</h3>
              <p className="mt-1 text-sm text-ink-muted">Envíos a todo el país o retiro a coordinar. La modalidad y el costo se confirman con cada pedido.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Landmark className="h-8 w-8 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-xl font-semibold uppercase">Pago por transferencia</h3>
              <p className="mt-1 text-sm text-ink-muted">Online solo transferencia bancaria. Tarjetas de crédito y débito únicamente en el local.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <ShieldCheck className="h-8 w-8 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-xl font-semibold uppercase">Cuentas validadas</h3>
              <p className="mt-1 text-sm text-ink-muted">Validamos manualmente cada cuenta antes de habilitar el acceso a casos y presupuestos.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border bg-card p-8 shadow-card md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-bold uppercase">¿Tenés un caso o presupuesto con nosotros?</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Creá tu cuenta con tus datos y los de tu vehículo. Una vez validada, vas a ver el estado de cada repuesto y tus presupuestos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ modo: "registro" }}>Crear cuenta</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{}}>Ingresar</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
