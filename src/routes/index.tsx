import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { ArrowRight, Archive, ClipboardList, FileText, PackageSearch, ShieldCheck, Truck, Landmark, Award, LogIn, MessageCircle, UserRound, Wrench } from "lucide-react";
import heroImg from "@/assets/hero-parts.jpg";
import { Button } from "@/components/ui/button";
import { getCatalogMeta } from "@/lib/public.functions";
import { useAuth } from "@/lib/auth";
import { BUSINESS } from "@/lib/business";

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
    icon: Archive,
    title: "Repuestos Oportunos",
    text: "Fichas de repuestos por modelo y año.",
    to: "/repuestos-oportunos" as const,
    cta: "Ver repuestos oportunos",
  },
  {
    icon: Wrench,
    title: "ACCESORIOS",
    text: "Accesorios para tu Honda.",
    to: "/accesorios" as const,
    cta: "Ver accesorios",
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
  const { user, ready } = useAuth();
  return (
    <>
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-10 sm:px-6 md:grid-cols-[2fr_3fr] md:gap-6 md:py-14 lg:px-8">
          <div>
            <p className="eyebrow text-primary">Repuestos · Honda Automóviles · Uruguay</p>
            <h1 className="mt-4 text-5xl font-bold uppercase leading-[0.95] lg:text-7xl">
              MANTENE TU HONDA ORIGINAL
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-muted">
              Repuestos organizados por modelo y categoría, presupuestos por número de chasis y el estado de cada
              repuesto de tu pedido.
            </p>
            {ready && (
              <Button asChild size="lg" variant="outline" className="mt-8">
                {user ? (
                  <Link to="/cuenta"><UserRound /> Mi cuenta</Link>
                ) : (
                  <Link to="/auth" search={{ modo: "login" }}><LogIn /> Iniciar sesión</Link>
                )}
              </Button>
            )}
          </div>
          <img src={heroImg} alt="" width={1920} height={1088} className="h-auto w-full object-contain" />
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <section id="whatsapp" aria-labelledby="whatsapp-title" className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 shadow-card">
          <div>
            <h2 id="whatsapp-title" className="text-2xl font-semibold uppercase">WhatsApp</h2>
            <p className="mt-1 text-muted-foreground">Consultanos por repuestos, disponibilidad y compatibilidad.</p>
          </div>
          <Button asChild size="lg" variant="outline">
            <a href={BUSINESS.whatsapp.url} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> Chatear al {BUSINESS.whatsapp.display}
            </a>
          </Button>
        </div>
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
