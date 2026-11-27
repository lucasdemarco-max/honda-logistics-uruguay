import { createFileRoute } from "@tanstack/react-router";
import { CatalogSection } from "@/components/site/CatalogSection";

export const Route = createFileRoute("/accesorios")({
  head: () => ({ meta: [{ title: "Accesorios — Honda Logistics" }] }),
  component: Accesorios,
});

function Accesorios() {
  return (
    <CatalogSection
      title="ACCESORIOS"
      description="Accesorios para tu Honda."
      emptyMessage="Todavía no hay fichas de accesorios cargadas."
    />
  );
}
