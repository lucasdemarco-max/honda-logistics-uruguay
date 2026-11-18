import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { StatusBadge } from "@/components/site/StatusBadge";
import { useAccess } from "@/lib/auth";
import { ACCOUNT_STATUSES } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/cuenta")({
  head: () => ({ meta: [{ title: "Mi cuenta — Honda Logistics" }, { name: "robots", content: "noindex" }] }),
  component: Cuenta,
});

function Cuenta() {
  const { data } = useAccess();
  const p = data?.profile;
  return (
    <>
      <PageHeader eyebrow="Área privada" title="Mi cuenta" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <h2 className="text-2xl font-semibold uppercase">{p?.full_name || "Tu cuenta"}</h2>
          <p className="text-sm text-muted-foreground">{p?.email}</p>
          <div className="mt-3"><StatusBadge options={ACCOUNT_STATUSES} value={p?.account_status} /></div>
          {p?.status_note && <p className="mt-2 text-sm">{p.status_note}</p>}
          <p className="mt-4 text-sm text-muted-foreground">Vehículos, casos, presupuestos y cambios de titularidad estarán disponibles en esta sección (pendiente de completar).</p>
        </section>
      </div>
    </>
  );
}
