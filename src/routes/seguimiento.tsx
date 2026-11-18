import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InfoPage, InfoCard } from "@/components/site/InfoPage";

export const Route = createFileRoute("/seguimiento")({
  head: () => ({
    meta: [
      { title: "Seguimiento de casos — Honda Logistics" },
      { name: "description", content: "Cada caso agrupa varios repuestos y cada uno tiene su propio estado, fecha y observaciones." },
      { property: "og:title", content: "Seguimiento de casos — Honda Logistics" },
      { property: "og:description", content: "Cada caso agrupa varios repuestos y cada uno tiene su propio estado, fecha y observaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <InfoPage eyebrow="Clientes" title="Seguimiento de casos" description="Cada caso agrupa varios repuestos y cada uno tiene su propio estado, fecha y observaciones.">
      <InfoCard title="Cómo funciona">
        <p>Estados de cada repuesto: Pendiente con Fabrica, En Transito de Entrega, Liberacion de Aduanas, En recepcion, Arribado, Despachado y Entregado.</p>
        <p>El seguimiento es privado: lo ves en tu cuenta una vez que Honda Logistics valida tus datos y tu vehículo.</p>
      </InfoCard>
      <Button asChild><Link to="/cuenta">Ver mis casos</Link></Button>
    </InfoPage>
  );
}
