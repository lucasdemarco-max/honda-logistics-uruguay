import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InfoPage, InfoCard } from "@/components/site/InfoPage";

export const Route = createFileRoute("/envios")({
  head: () => ({
    meta: [
      { title: "Envíos y formas de pago — Honda Logistics" },
      { name: "description", content: "Envíos dentro de Uruguay o retiro a coordinar. Pago online solo por transferencia bancaria." },
      { property: "og:title", content: "Envíos y formas de pago — Honda Logistics" },
      { property: "og:description", content: "Envíos dentro de Uruguay o retiro a coordinar. Pago online solo por transferencia bancaria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <InfoPage eyebrow="Información" title="Envíos y formas de pago" description="Envíos dentro de Uruguay o retiro a coordinar. Pago online solo por transferencia bancaria.">
      <InfoCard title="Envíos">
        <p>Realizamos envíos dentro de Uruguay. La modalidad y el costo se coordinan con cada pedido. También podés coordinar el retiro.</p>
      </InfoCard>
      <InfoCard title="Pagos">
        <p>Online: únicamente transferencia bancaria. Tarjetas de crédito y débito: solo en el local físico.</p>
      </InfoCard>
    </InfoPage>
  );
}
