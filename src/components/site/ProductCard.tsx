import { ShieldCheck, ShoppingCart, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HONDA_RELATIONS, canClaimHomologation } from "@/lib/labels";
import { formatUYU } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { GENERIC_PRODUCT_PHOTO, getHondaProductPhoto } from "@/lib/product-photos";
import type { CatalogProduct } from "@/lib/public.functions";

export function ProductCard({ product, modelSlug }: { product: CatalogProduct; modelSlug?: string }) {
  const { add } = useCart();
  const relation = HONDA_RELATIONS.find((r) => r.value === product.honda_relation);
  const showRelation = relation && canClaimHomologation(product.honda_relation, product.homologation_reference);
  const outOfStock = product.availability === "sin_stock";
  const image = product.honda_relation === "homologado_honda"
    ? getHondaProductPhoto(product.honda_code)
    : undefined;
  const compatibility = modelSlug
    ? product.compat.filter((application) => application.model_slug === modelSlug)
    : product.compat;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden border-b bg-card">
        <img
          src={image?.url ?? GENERIC_PRODUCT_PHOTO}
          alt={image ? product.name : ""}
          loading="lazy"
          width={800}
          height={600}
          className={image ? "h-full w-full object-contain p-4" : "h-full w-full object-cover opacity-60"}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_demo && <Badge variant="demo">Ejemplo</Badge>}
          {product.promo_text && <Badge>{product.promo_text}</Badge>}
        </div>
        {image ? (
          <a
            href={image.source}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 rounded bg-card px-1.5 py-0.5 text-xs text-muted-foreground underline underline-offset-2"
          >
            Fuente de la foto
          </a>
        ) : (
          <span className="absolute inset-x-0 bottom-0 bg-ink/85 px-2 py-2 text-center text-sm font-medium text-ink-foreground">
            Imagen no disponible
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="eyebrow text-primary">{product.brand?.name ?? product.category?.name ?? "Repuesto"}</span>
          <span className="font-mono">{product.sku}</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold leading-tight">{product.name}</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Código Honda: {product.honda_code ? <span className="text-foreground">{product.honda_code}</span> : "no informado"}
          </p>
        </div>
        {product.description && <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}

        {showRelation && (
          <div className="flex items-start gap-1.5 text-xs" title={relation.description || relation.label}>
            {relation.value === "homologado_honda" ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-info" aria-hidden />
            )}
            <span>
              <strong>{relation.label}</strong>
              {relation.description ? (
                <>
                  . <span className="text-muted-foreground">{relation.description}</span>
                </>
              ) : null}
            </span>
          </div>
        )}

        <div className="rounded-md bg-muted/70 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compatibilidad cargada</p>
          {compatibility.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin aplicaciones cargadas. Consultanos con tu número de chasis.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {compatibility.map((c, i) => (
                <li key={i} className="rounded border bg-card px-2 py-0.5 text-xs">
                  {c.model} <span className="text-muted-foreground">{c.year_from === c.year_to ? c.year_from : `${c.year_from}–${c.year_to}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div>
            <p className="font-display text-2xl font-bold leading-none">{formatUYU(product.price_uyu)}</p>
            {product.is_demo && product.price_uyu !== null && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">Precio ilustrativo</p>
            )}
          </div>
          <Button
            size="icon"
            aria-label={`Agregar ${product.name} al carrito`}
            disabled={outOfStock}
            onClick={() => {
              add({ productId: product.id, sku: product.sku, name: product.name, priceUYU: product.price_uyu, imageUrl: image?.url ?? null });
              toast.success("Agregado al carrito", { description: product.name });
            }}
          >
            <ShoppingCart />
          </Button>
        </div>
      </div>
    </article>
  );
}
