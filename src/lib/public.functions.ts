import { createServerFn } from "@tanstack/react-start";
import { filterCatalogProducts, validateCatalogQuery } from "@/lib/catalog";

export type {
  Brand,
  Category,
  VehicleModel,
  ProductRow,
  CatalogProduct,
  CatalogQuery,
} from "@/lib/catalog";

export const getCatalogMeta = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCatalogSnapshot } = await import("@/lib/catalog.server");
  return (await loadCatalogSnapshot()).meta;
});

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator(validateCatalogQuery)
  .handler(async ({ data }) => {
    const { loadCatalogSnapshot } = await import("@/lib/catalog.server");
    return filterCatalogProducts(await loadCatalogSnapshot(), data);
  });

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const { publicCatalogClient, readCatalogPages } = await import("@/lib/catalog.server");
  const sb = publicCatalogClient();
  return readCatalogPages((from, to) =>
    sb
      .from("brands")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("id")
      .range(from, to),
  );
});

export const getBrand = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 80) }))
  .handler(async ({ data }) => {
    const { loadCatalogSnapshot } = await import("@/lib/catalog.server");
    const snapshot = await loadCatalogSnapshot();
    const brand = snapshot.meta.brands.find((item) => item.slug === data.slug);
    return brand ? { brand, products: filterCatalogProducts(snapshot, { marca: brand.id }) } : null;
  });
