import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InfoPage, InfoCard } from "@/components/site/InfoPage";

export const Route = createFileRoute("/marcas")({
  head: () => ({
    meta: [
      { title: "Marcas Asociadas — Honda Logistics" },
      { name: "description", content: "Neumáticos, baterías, lubricantes y accesorios. Indicamos claramente si un producto es homologado por Honda, compatible o recomendado." },
      { property: "og:title", content: "Marcas Asociadas — Honda Logistics" },
      { property: "og:description", content: "Neumáticos, baterías, lubricantes y accesorios. Indicamos claramente si un producto es homologado por Honda, compatible o recomendado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <InfoPage eyebrow="Marcas" title="Marcas Asociadas" description="Neumáticos, baterías, lubricantes y accesorios. Indicamos claramente si un producto es homologado por Honda, compatible o recomendado.">
      <InfoCard title="Homologado vs. compatible">
        <p>Solo mostramos “Homologado por Honda” cuando existe respaldo documental. El resto se indica como compatible o recomendado.</p>
      </InfoCard>
      <Button asChild><Link to="/catalogo">Ver productos</Link></Button>
    </InfoPage>
  );
}
