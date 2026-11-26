/** Universal, preservative catalog sync. Defaults to a read-only preview. */
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImportRecords, type CatalogLookup } from "../src/lib/admin-import.ts";
import { readImportWorkbook, validateImportFile } from "../src/lib/import-workbook.ts";
import type { LegacyCatalogProduct } from "../src/lib/catalog.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const options = new Map<string, string>();
let write = false;
for (let index = 0; index < args.length; index++) {
  const option = args[index];
  if (option === "--write") {
    write = true;
    continue;
  }
  if (option === "--help") {
    console.log(
      "Uso: bun run sync:catalogo --input catalogo.xlsx [--output src/data/filtros.json] [--write]\nSin --write solo valida. Conserva todos los SKU y aplicaciones anteriores.",
    );
    process.exit(0);
  }
  if (
    (option === "--input" || option === "--output") &&
    args[index + 1] &&
    !args[index + 1]!.startsWith("--")
  ) {
    options.set(option, args[++index]!);
  } else {
    throw new Error(`Argumento desconocido o incompleto: ${option ?? ""}. Usá --help.`);
  }
}

const input = options.get("--input");
if (!input) throw new Error("Indicá --input con el archivo Excel o CSV. Usá --help.");
const inputPath = path.resolve(input);
const outputPath = path.resolve(
  options.get("--output") ?? path.join(projectRoot, "src/data/filtros.json"),
);
const basePath = fs.existsSync(outputPath)
  ? outputPath
  : path.join(projectRoot, "src/data/filtros.json");
validateImportFile(inputPath, fs.statSync(inputPath).size);
const workbook = readImportWorkbook(
  XLSX.read(fs.readFileSync(inputPath), { type: "buffer", raw: true, cellNF: true }),
);
const existing: LegacyCatalogProduct[] = JSON.parse(fs.readFileSync(basePath, "utf8"));
if (
  !Array.isArray(existing) ||
  existing.some((product) => !product.id || !product.sku || !Array.isArray(product.compat))
) {
  throw new Error("El catálogo base no tiene una estructura válida; no se modificó el archivo.");
}

const categoryMap = new Map<string, CatalogLookup>();
const modelMap = new Map<string, CatalogLookup>();
for (const product of existing) {
  if (product.category) categoryMap.set(product.category.id, product.category);
  for (const application of product.compat) {
    const id = application.model_id ?? `model-${application.model_slug}`;
    modelMap.set(id, { id, slug: application.model_slug, name: application.model });
  }
}
let plan = prepareImportRecords(
  workbook.records,
  [...categoryMap.values()],
  [...modelMap.values()],
);
let errors = plan.rows.filter((row) => row.error).map((row) => row.error);
if (errors.length) throw new Error(errors.join("\n"));
for (const category of plan.newCategories) {
  const id = `category-${category.slug}`;
  categoryMap.set(id, { ...category, id });
}
for (const model of plan.newModels) {
  const id = `model-${model.slug}`;
  modelMap.set(id, { ...model, id });
}
plan = prepareImportRecords(workbook.records, [...categoryMap.values()], [...modelMap.values()]);
errors = plan.rows.filter((row) => row.error).map((row) => row.error);
if (errors.length || plan.newCategories.length || plan.newModels.length) {
  throw new Error(errors.join("\n") || "No se pudieron resolver los identificadores del catálogo.");
}

const products = new Map(existing.map((product) => [product.sku, structuredClone(product)]));
const touched = new Set<string>();
const timestamp = new Date().toISOString();
let additions = 0;
for (const row of plan.rows) {
  const category = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
  if (!category) throw new Error(`No se pudo resolver la categoría de ${row.sku}`);
  let product = products.get(row.sku);
  if (!product) {
    product = {
      id: `catalog-${row.sku}`,
      sku: row.sku,
      name: row.name,
      category_id: category.id,
      category: { ...category, image_key: null },
      brand_id: null,
      brand: null,
      honda_code: null,
      description: null,
      honda_relation: null,
      homologation_reference: null,
      price_uyu: null,
      stock: null,
      availability: "consultar",
      active: true,
      is_demo: false,
      image_url: null,
      promo_text: null,
      created_at: timestamp,
      updated_at: timestamp,
      compat: [],
    };
    products.set(row.sku, product);
  }
  if (!touched.has(row.sku)) {
    product.name = row.name;
    product.category_id = category.id;
    product.category = {
      ...category,
      image_key: product.category?.id === category.id ? product.category.image_key : null,
    };
    if (row.provided.hondaCode) product.honda_code = row.hondaCode;
    if (row.provided.description) product.description = row.description;
    if (row.provided.price) product.price_uyu = row.price;
    if (row.provided.stock) product.stock = row.stock;
    if (row.provided.availability) product.availability = row.availability;
    if (row.provided.active) product.active = row.active;
    product.updated_at = timestamp;
    touched.add(row.sku);
  }
  const model = row.modelId ? modelMap.get(row.modelId) : undefined;
  if (model) {
    const notes = row.compatibilityNotes.trim() || null;
    const sameApplication = product.compat.some(
      (application) =>
        (application.model_id === model.id || application.model_slug === model.slug) &&
        application.year_from === row.yearFrom &&
        application.year_to === row.yearTo &&
        (!notes || (application.notes?.trim() || null) === notes),
    );
    if (!sameApplication) {
      product.compat.push({
        model_id: model.id,
        model: model.name,
        model_slug: model.slug,
        year_from: row.yearFrom,
        year_to: row.yearTo,
        notes,
      });
      additions++;
    }
  }
}

const result = [...products.values()];
console.log(
  `${workbook.sheets.length} hojas, ${plan.rows.length} filas válidas, ${touched.size} SKU en el archivo.`,
);
console.log(
  `Catálogo: ${existing.length} → ${result.length} productos; ${additions} aplicaciones agregadas. Ningún SKU anterior eliminado.`,
);
for (const warning of plan.warnings) console.log(warning);
if (write) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.renameSync(temporaryPath, outputPath);
  console.log(`Guardado: ${outputPath}`);
} else {
  console.log(
    "Vista previa: no se escribió ningún archivo. Agregá --write para guardar el catálogo combinado.",
  );
}
