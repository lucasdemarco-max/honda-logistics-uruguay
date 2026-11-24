import xlsx from "xlsx";
import fs from "fs";
import path from "path";

const excelPath = "C:/Users/ldemarco.HONDA/.gemini/antigravity/scratch/Bases de Excel/Filtros.xlsx";
const outputPath = "C:/Users/ldemarco.HONDA/.gemini/antigravity/scratch/honda-logistics-uruguay/src/data/filtros.json";

const MODEL_NAMES: Record<string, { name: string; slug: string }> = {
  "WR-V": { name: "WR-V", slug: "wr-v" },
  "HR-V": { name: "HR-V", slug: "hr-v" },
  "CR-V": { name: "CR-V", slug: "cr-v" },
  "RIDGELINE": { name: "Ridgeline", slug: "ridgeline" },
  "ZR-V": { name: "ZR-V", slug: "zr-v" },
  "PILOT": { name: "Pilot", slug: "pilot" },
  "CITY": { name: "City", slug: "city" },
  "FIT": { name: "Fit", slug: "fit" },
  "CIVIC": { name: "Civic", slug: "civic" },
  "ACCORD": { name: "Accord", slug: "accord" },
  "ODYSSEY": { name: "Odyssey", slug: "odyssey" },
  "TYPE-R": { name: "Civic Type R", slug: "type-r" },
};

function getSubcategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("aire acondicionado") || n.includes("polen") || n.includes("habitaculo")) {
    return { id: "subcat-polen", name: "Filtros de Polen", slug: "filtros-polen", image_key: "filtros" };
  }
  if (n.includes("aire")) {
    return { id: "subcat-aire", name: "Filtro de Aire", slug: "filtros-aire", image_key: "filtros" };
  }
  if (n.includes("combustible")) {
    return { id: "subcat-combustible", name: "Filtros de Combustible", slug: "filtros-combustible", image_key: "filtros" };
  }
  if (n.includes("transmision") || n.includes("cvt") || n.includes("diferencial") || n.includes("caja")) {
    return { id: "subcat-caja", name: "Filtros de Caja de Cambio", slug: "filtros-caja-cambio", image_key: "filtros" };
  }
  return { id: "subcat-aceite", name: "Filtros de Aceite", slug: "filtros-aceite", image_key: "filtros" };
}

interface RawRow {
  SKU: string | number;
  NAME: string;
  CategoryID: string;
  CategoryName: string;
  HondaCode: string;
  Description: string;
  Price: number;
  Stock: number;
  availability: unknown;
  Active: string;
  ModelID: string;
  YearFrom: string | number;
  YearTo: string | number;
  CompatibilityNotes: string;
}

const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets["FIltros"];
const rows = xlsx.utils.sheet_to_json<RawRow>(sheet, { defval: "" });

const productMap = new Map<string, any>();

for (const r of rows) {
  const sku = String(r.SKU).trim();
  if (!sku) continue;

  const rawModel = String(r.ModelID).trim().toUpperCase();
  const modelInfo = MODEL_NAMES[rawModel] || { name: r.ModelID, slug: rawModel.toLowerCase() };
  const yearFrom = Number(r.YearFrom) || 1995;
  const yearTo = Number(r.YearTo) || new Date().getFullYear() + 1;

  if (!productMap.has(sku)) {
    const subcat = getSubcategory(String(r.NAME));
    productMap.set(sku, {
      id: `fil-${sku}`,
      sku: sku,
      honda_code: String(r.HondaCode).trim() || null,
      name: String(r.NAME).trim(),
      description: String(r.Description || r.NAME).trim(),
      category_id: subcat.id,
      brand_id: null,
      honda_relation: "homologado_honda",
      homologation_reference: "Pieza Original Honda",
      price_uyu: Number(r.Price) || null,
      stock: Number(r.Stock) || 0,
      availability: Number(r.Stock) > 0 ? "en_stock" : "consultar",
      image_url: null,
      promo_text: null,
      active: String(r.Active).toLowerCase() !== "no",
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: subcat,
      brand: null,
      compat: [],
    });
  }

  const p = productMap.get(sku);
  const exists = p.compat.some((c: any) => c.model_slug === modelInfo.slug && c.year_from === yearFrom && c.year_to === yearTo);
  if (!exists) {
    p.compat.push({
      model: modelInfo.name,
      model_slug: modelInfo.slug,
      year_from: yearFrom,
      year_to: yearTo,
      notes: String(r.CompatibilityNotes).trim() || null,
    });
  }
}

const products = Array.from(productMap.values());

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), "utf-8");

console.log(`Generated ${products.length} products from ${rows.length} rows.`);
