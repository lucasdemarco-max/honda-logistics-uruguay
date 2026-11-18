import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InfoPage, InfoCard } from "@/components/site/InfoPage";

export const Route = createFileRoute("/presupuestos")({
  head: () => ({
    meta: [
      { title: "Presupuestos por chasis — Honda Logistics" },
      { name: "description", content: "Consultá los presupuestos asociados al número de chasis (VIN) de tu vehículo." },
      { property: "og:title", content: "Presupuestos por chasis — Honda Logistics" },
      { property: "og:description", content: "Consultá los presupuestos asociados al número de chasis (VIN) de tu vehículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <InfoPage eyebrow="Clientes" title="Presupuestos por chasis" description="Consultá los presupuestos asociados al número de chasis (VIN) de tu vehículo.">
      <InfoCard title="Cómo funciona">
        <p>Nuestro equipo carga cada presupuesto con número, fecha, repuestos, códigos, cantidades y precios en UYU.</p>
        <p>Por seguridad, el VIN o la patente no alcanzan para ver un presupuesto: necesitás una cuenta validada.</p>
      </InfoCard>
      <Button asChild><Link to="/cuenta">Ver mis presupuestos</Link></Button>
    </InfoPage>
  );
}
