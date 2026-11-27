import { createFileRoute } from "@tanstack/react-router";
import { CatalogSection } from "@/components/site/CatalogSection";

export const Route = createFileRoute("/repuestos-oportunos")({
  head: () => ({ meta: [{ title: "Repuestos Oportunos — Honda Logistics" }] }),
  component: RepuestosOportunos,
});

function RepuestosOportunos() {
  return (
    <CatalogSection
      title="Repuestos Oportunos"
      description="Fichas de repuestos por modelo y año."
      emptyMessage="Todavía no hay fichas de repuestos oportunos cargadas."
    />
  );
}
