import { ShieldCheck, ShoppingCart, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { AVAILABILITY, HONDA_RELATIONS, canClaimHomologation } from "@/lib/labels";
import { formatUYU } from "@/lib/format";
import { useCart } from "@/lib/cart";
import type { CatalogProduct } from "@/lib/public.functions";

export function productImage(p: Pick<CatalogProduct, "image_url" | "category">) {
  if (p.image_url) return p.image_url;
  if (p.category?.image_key) return `/images/categories/${p.category.image_key}.jpg`;
  return "/images/categories/otros.jpg";
}

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { add } = useCart();
  const relation = HONDA_RELATIONS.find((r) => r.value === product.honda_relation);
  const showRelation = relation && canClaimHomologation(product.honda_relation, product.homologation_reference);
  const outOfStock = product.availability === "sin_stock";

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={productImage(product)}
          alt={product.image_url ? product.name : `Imagen ilustrativa de la categoría ${product.category?.name ?? ""}`}
          loading="lazy"
          width={944}
          height={704}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_demo && <Badge variant="demo">Ejemplo</Badge>}
          {product.promo_text && <Badge>{product.promo_text}</Badge>}
        </div>
        {!product.image_url && (
          <span className="absolute bottom-2 right-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-ink-foreground">
            Imagen ilustrativa
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
          <div className="flex items-start gap-1.5 text-xs" title={relation.description}>
            {relation.value === "homologado_honda" ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-info" aria-hidden />
            )}
            <span>
              <strong>{relation.label}.</strong> <span className="text-muted-foreground">{relation.description}</span>
            </span>
          </div>
        )}

        <div className="rounded-md bg-muted/70 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compatibilidad cargada</p>
          {product.compat.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin aplicaciones cargadas. Consultanos con tu número de chasis.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {product.compat.map((c, i) => (
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
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge options={AVAILABILITY} value={product.availability} />
              {typeof product.stock === "number" && <span className="text-xs text-muted-foreground">{product.stock} u.</span>}
            </div>
          </div>
          <Button
            size="icon"
            aria-label={`Agregar ${product.name} al carrito`}
            disabled={outOfStock}
            onClick={() => {
              add({ productId: product.id, sku: product.sku, name: product.name, priceUYU: product.price_uyu, imageUrl: productImage(product) });
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
