import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CatalogLookup } from "./admin-import";
import { compatibilityId, type CatalogImportStore, type Compatibility } from "./catalog-import";

const PAGE_SIZE = 500;
const chunksOf = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

export function createCatalogImportStore(client: SupabaseClient<Database>): CatalogImportStore {
  async function readLookups(table: "categories" | "vehicle_models"): Promise<CatalogLookup[]> {
    const rows: CatalogLookup[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select("id, name, slug")
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  return {
    async authorize() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error("Iniciá sesión para importar productos");
      const permission = await client.rpc("has_permission", {
        _user_id: data.user.id,
        _perm: "catalogo",
      });
      if (permission.error) throw permission.error;
      if (!permission.data)
        throw new Error("Tu cuenta no tiene permiso para administrar el catálogo");
    },
    async getLookups() {
      const [categories, models] = await Promise.all([
        readLookups("categories"),
        readLookups("vehicle_models"),
      ]);
      return { categories, models };
    },
    async createLookups(kind, items) {
      const { data, error } = await client
        .from(kind === "categories" ? "categories" : "vehicle_models")
        .upsert(
          items.map(({ name, slug }) => ({ name, slug })),
          { onConflict: "slug", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      return data.length;
    },
    async getProducts(skus) {
      const products: Database["public"]["Tables"]["products"]["Row"][] = [];
      for (const batch of chunksOf(skus, 100)) {
        const { data, error } = await client.from("products").select("*").in("sku", batch);
        if (error) throw error;
        products.push(...data);
      }
      return products;
    },
    async getCompatibilities(productIds) {
      const compatibilities: Compatibility[] = [];
      for (const batch of chunksOf(productIds, 100)) {
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await client
            .from("product_compatibilities")
            .select("*")
            .in("product_id", batch)
            .order("id")
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          compatibilities.push(...data);
          if (data.length < PAGE_SIZE) break;
        }
      }
      return compatibilities;
    },
    async saveProduct(values, existingId) {
      const result = existingId
        ? await client
            .from("products")
            .update(values)
            .eq("id", existingId)
            .select("id, sku")
            .single()
        : await client.from("products").insert(values).select("id, sku").single();
      if (result.error) throw result.error;
      return result.data;
    },
    async addCompatibilities(values) {
      const rows = await Promise.all(
        values.map(async (value) => ({ ...value, id: await compatibilityId(value) })),
      );
      const { data, error } = await client
        .from("product_compatibilities")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return data.length;
    },
  };
}
