import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel administrativo — Honda Logistics" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_staff", { _user_id: (context as { user: { id: string } }).user.id });
    if (!data) throw redirect({ to: "/cuenta" });
  },
  component: Admin,
});

function Admin() {
  return (
    <>
      <PageHeader eyebrow="Administración" title="Panel administrativo" />
      <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        Las pantallas de gestión (clientes, casos, presupuestos, catálogo, marcas, titularidad y auditoría) están pendientes de construir. Los permisos ya están aplicados en la base de datos.
      </div>
    </>
  );
}
