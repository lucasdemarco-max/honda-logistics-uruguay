import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { useCart } from "@/lib/cart";
import { formatUYU } from "@/lib/format";
import { MAX_QTY } from "@/lib/cart-logic";
import { GENERIC_PRODUCT_PHOTO, getReviewedCartPhoto } from "@/lib/product-photos";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [
      { title: "Carrito — Honda Logistics" },
      { name: "description", content: "Revisá los repuestos seleccionados, ajustá cantidades y continuá con tu solicitud de pedido." },
      { property: "og:title", content: "Carrito — Honda Logistics" },
      { property: "og:description", content: "Tu selección de repuestos Honda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Carrito,
});

function CartProductPhoto({ url }: { url: string | null | undefined }) {
  const photo = getReviewedCartPhoto(url);
  return (
    <figure className="relative h-18 w-24 shrink-0 overflow-hidden rounded bg-muted">
      <img
        src={photo ?? GENERIC_PRODUCT_PHOTO}
        alt=""
        width={96}
        height={72}
        loading="lazy"
        className={photo ? "h-full w-full object-contain" : "h-full w-full object-cover opacity-60"}
      />
      {!photo && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-ink/85 px-1 py-1 text-center text-xs leading-tight text-ink-foreground">
          Foto no disponible
        </figcaption>
      )}
    </figure>
  );
}

function Carrito() {
  const { items, totals, update, remove, clear, hydrated } = useCart();

  return (
    <>
      <PageHeader eyebrow="Compra" title="Carrito" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {!hydrated ? null : items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Tu carrito está vacío"
            description="Agregá repuestos desde el catálogo para armar tu solicitud."
            action={<Button asChild><Link to="/catalogo">Ir al catálogo</Link></Button>}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <section aria-label="Artículos">
              <ul className="divide-y rounded-lg border bg-card shadow-card">
                {items.map((i) => (
                  <li key={i.productId} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <CartProductPhoto url={i.imageUrl} />
                    <div className="flex-1">
                      <p className="font-semibold">{i.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{i.sku}</p>
                      <p className="mt-1 text-sm">{formatUYU(i.priceUYU)} <span className="text-muted-foreground">c/u</span></p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${i.name}`}>
                      <Button size="icon" variant="outline" aria-label="Restar uno" onClick={() => update(i.productId, i.quantity - 1)}>
                        <Minus />
                      </Button>
                      <input
                        type="number"
                        min={1}
                        max={MAX_QTY}
                        value={i.quantity}
                        onChange={(e) => update(i.productId, Number(e.target.value) || 1)}
                        className="h-9 w-14 rounded-md border bg-background text-center text-sm"
                        aria-label="Cantidad"
                      />
                      <Button size="icon" variant="outline" aria-label="Sumar uno" onClick={() => update(i.productId, i.quantity + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <div className="w-32 text-right font-semibold">
                      {i.priceUYU === null ? <span className="text-sm text-muted-foreground">A confirmar</span> : formatUYU(i.priceUYU * i.quantity)}
                    </div>
                    <Button size="icon" variant="ghost" aria-label={`Quitar ${i.name}`} onClick={() => remove(i.productId)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" className="mt-3" onClick={clear}>Vaciar carrito</Button>
            </section>
            <aside className="h-fit rounded-lg border bg-card p-6 shadow-card lg:sticky lg:top-24">
              <h2 className="text-2xl font-semibold uppercase">Resumen</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt>Artículos</dt><dd>{totals.units}</dd></div>
                <div className="flex justify-between"><dt>Envío</dt><dd className="text-muted-foreground">A coordinar</dd></div>
                <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatUYU(totals.total)}</dd></div>
              </dl>
              {totals.unpricedCount > 0 && (
                <p className="mt-3 rounded bg-warning-soft p-2 text-xs text-warning-foreground">
                  {totals.unpricedCount} artículo{totals.unpricedCount > 1 ? "s" : ""} con precio a confirmar, no incluido{totals.unpricedCount > 1 ? "s" : ""} en el total.
                </p>
              )}
              <Button asChild size="lg" className="mt-5 w-full"><Link to="/checkout">Continuar</Link></Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Pago online solo por transferencia bancaria. Tarjetas de crédito y débito únicamente en el local físico.
              </p>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
