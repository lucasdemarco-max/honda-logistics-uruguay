/**
 * Regenerate the catalog snapshot from original WEB - Fichas .xls/.xlsx files.
 * Usage: npm run sync:web-fichas
 * Put the original spreadsheets in catalog-sources/, retaining filenames.
 * Only categories with provided valid spreadsheets are refreshed.
 * This script does not write to Supabase or to Lovable-managed schema files.
 */
import XLSX from "xlsx";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

const SOURCE_DIR = "catalog-sources";
const OUTPUT = "src/data/catalogo-web-fichas.json";
const MODEL_NAMES: Record<string, string> = {
  "RIGELINE": "Ridgeline", "RIDGELINE": "Ridgeline",
  "TYPE-R": "Civic Type R", "CIVIC": "Civic", "FIT": "Fit",
  "CITY": "City", "HR-V": "HR-V", "CR-V": "CR-V",
  "WR-V": "WR-V", "ZR-V": "ZR-V", "PILOT": "Pilot",
  "ACCORD": "Accord", "ODYSSEY": "Odyssey",
};
const normalize = (s: unknown) => String(s ?? "").trim();
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const old = JSON.parse(await readFile(OUTPUT, "utf8")) as Record<string, any>[];
const bySku = new Map<string, any>(old.map((p) => [p.sku, p]));
const files = (await readdir(SOURCE_DIR)).filter((name) =>
  name.startsWith("WEB - Fichas - ") && /\.xlsx?$/i.test(name)).sort();
if (!files.length) throw new Error(`No se encontraron archivos WEB - Fichas en ${SOURCE_DIR}`);

const errors: string[] = [];
let refreshed = 0;
for (const name of files) {
  const workbook = XLSX.readFile(join(SOURCE_DIR, name));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) { errors.push(`${name}: planilla vacía`); continue; }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const families = new Set(rows.map((r) => normalize(r["CategoryID"])).filter(Boolean));
  const filenameCategory = basename(name).replace(/\.xlsx?$/i, "").replace(/^WEB - Fichas - /, "").replace(/^Prabrisas$/i, "Parabrisas");
  const matchingFamily = Array.from(families).every((family) =>
    slug(family) === slug(filenameCategory));
  if (!matchingFamily) {
    errors.push(`${name}: CategoryID (${Array.from(families).join(", ")}) no corresponde al nombre del archivo`);
    continue;
  }
  const incoming = new Map<string, any>();
  for (const [index, r] of rows.entries()) {
    const sku = normalize(r["SKU"]), code = normalize(r["Honda Code"]);
    const family = normalize(r["CategoryID"]), modelRaw = normalize(r["Modelo"]).toUpperCase();
    const model = MODEL_NAMES[modelRaw];
    const from = Number(r["Year From"]), to = Number(r["YearTo"]);
    if (!sku || !code || !family || !model || !Number.isInteger(from)
      || !Number.isInteger(to) || from > to || from < 1970 || to > 2100) {
      errors.push(`${name} fila ${index + 2}: faltan campos obligatorios o años incorrectos`);
      continue;
    }
    const existing = incoming.get(sku);
    if (existing && (existing.honda_code !== code || existing.category.name !== family)) {
      errors.push(`${name} fila ${index + 2}: SKU contradictorio ${sku}`);
      continue;
    }
    const price = Number(r["Price"]), stock = Number(r["Stock"]);
    const p = existing ?? {
      id: `web-${sku}`, sku, honda_code: code,
      name: normalize(r["Name"]), description: normalize(r["Descripcion"] || r["Name"]),
      category_id: `web-${slug(family)}`, brand_id: null, honda_relation: null,
      homologation_reference: null, price_uyu: Number.isFinite(price) ? price : null,
      stock: Number.isFinite(stock) ? stock : null, availability: stock > 0 ? "en_stock" : "consultar",
      image_url: null, promo_text: null, active: normalize(r["Active"]).toLowerCase() !== "no",
      is_demo: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      category: { id: `web-${slug(family)}`, name: family, slug: slug(family), image_key: null },
      brand: null, compat: [] as { model: string; model_slug: string; year_from: number; year_to: number; notes: null }[],
      source_files: [name],
    };
    const compat = { model, model_slug: model === "Civic Type R" ? "type-r" : slug(model),
      year_from: from, year_to: to, notes: null };
    if (!p.compat.some((c: typeof compat) => c.model_slug === compat.model_slug
      && c.year_from === from && c.year_to === to)) p.compat.push(compat);
    incoming.set(sku, p);
  }
  if (!incoming.size) { errors.push(`${name}: no hay registros válidos, se conserva la categoría existente`); continue; }
  // Refresh only the family represented by this file; all other categories remain untouched.
  const touched = new Set(Array.from(incoming.values(), (p) => p.category.slug));
  for (const [sku, oldProduct] of bySku) {
    if (touched.has(oldProduct.category?.slug)) bySku.delete(sku);
  }
  for (const [sku, product] of incoming) {
    const previous = bySku.get(sku);
    if (previous && previous.category?.slug !== product.category.slug) {
      errors.push(`${name}: SKU ${sku} ya pertenece a ${previous.category?.name}`);
      continue;
    }
    bySku.set(sku, product);
  }
  refreshed++;
}
await writeFile(OUTPUT, JSON.stringify(Array.from(bySku.values()), null, 2) + "\n", "utf8");
console.log(`Categorías actualizadas: ${refreshed} | Productos totales: ${bySku.size}`);
if (errors.length) console.warn("Observaciones:\n" + errors.join("\n"));
