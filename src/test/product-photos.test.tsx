import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/components/site/ProductCard";
import filters from "@/data/filtros.json";
import { CartProvider } from "@/lib/cart";
import { getReviewedCartPhoto } from "@/lib/product-photos";
import type { CatalogProduct } from "@/lib/public.functions";

function showProduct(code: string, overrides: Partial<CatalogProduct> = {}) {
  const product = (filters as unknown as CatalogProduct[]).find((item) => item.honda_code === code);
  if (!product) throw new Error(`Missing sample product ${code}`);
  return render(
    <CartProvider>
      <ProductCard product={{ ...product, ...overrides }} modelSlug="civic" />
    </CartProvider>,
  );
}

describe("Catalog product photos", () => {
  it("shows a reviewed photo for an original Honda part", () => {
    showProduct("15400-RTA-003");
    expect(screen.getByRole("img", { name: "Filtro de Aceite" }))
      .toHaveAttribute("src", "/images/products/15400-rta-003.webp");
    expect(screen.getByText("Civic")).toBeInTheDocument();
    expect(screen.queryByText("Imagen no disponible")).not.toBeInTheDocument();
  });

  it("uses the generic image when a photo failed review, even with a stored image URL", () => {
    const { container } = showProduct("80291-TF0-U01", { image_url: "/old-cabin-filter.jpg" });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
    expect(screen.queryByText("Fuente de la foto")).not.toBeInTheDocument();
  });

  it("does not apply a Honda photo to a compatible product with the same code", () => {
    const { container } = showProduct("15400-RTA-003", { honda_relation: "compatible" });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Imagen no disponible")).toBeInTheDocument();
  });

  it("rejects removed photos in saved carts", () => {
    expect(getReviewedCartPhoto("/images/products/17048-t7j-000.webp")).toBeUndefined();
    expect(getReviewedCartPhoto("/images/products/15400-rta-003.webp"))
      .toBe("/images/products/15400-rta-003.webp");
  });
});
