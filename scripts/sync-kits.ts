import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";

type Component = {
  code: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  finalPrice: number | null;
};
type Kit = {
  name: string;
  years: string;
  kind: "Servicio" | "Auxiliar";
  components: number[];
};

const text = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  if (value === "" || value == null) return null;
  const number = Number(typeof value === "string" ? value.trim().replace(",", ".") : value);
  if (!Number.isFinite(number)) throw new Error(`Importe o cantidad inválidos: ${value}`);
  return number;
};
const columns = {
  name: "Nomenclatura de Kit",
  platform: "Plataforma",
  years: "Años de Utilizacion",
  code: "Codigo de Pieza",
  description: "Descripcion",
  quantity: "Qty x Kit",
  unitPrice: "Precio Unitario",
  finalPrice: "Precio Final",
} as const;

const files = process.argv.slice(2);
if (files.length !== 2) throw new Error("Indicá las planillas de Kits de Servicio y Kits Auxiliar.");
const platforms = new Map<string, Map<string, Kit>>();
const components: Component[] = [];
const componentIndexes = new Map<string, number>();
const kinds = new Set<Kit["kind"]>();
let rows = 0;

for (const file of files) {
  const filename = basename(file);
  const kind = /kits de servicio/i.test(filename) ? "Servicio" : /kits auxiliar/i.test(filename) ? "Auxiliar" : null;
  if (!kind || kinds.has(kind)) throw new Error(`Origen de kits inválido: ${filename}`);
  kinds.add(kind);
  const workbook = XLSX.read(readFileSync(file), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const [header, ...data] = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  for (const column of Object.values(columns)) {
    if (!header?.includes(column)) throw new Error(`Falta la columna ${column} en ${filename}`);
  }

  for (const row of data) {
    const get = (key: keyof typeof columns) => row[header.indexOf(columns[key])];
    const name = text(get("name"));
    const platform = text(get("platform"));
    const years = text(get("years"));
    const code = text(get("code"));
    if (!name && !platform && !code) continue;
    if (!name || !platform || !years || !code) throw new Error(`Fila incompleta en ${filename}: ${row.join(" | ")}`);

    const component: Component = {
      code,
      description: text(get("description")),
      quantity: amount(get("quantity")),
      unitPrice: amount(get("unitPrice")),
      finalPrice: amount(get("finalPrice")),
    };
    const componentKey = JSON.stringify(component);
    let componentIndex = componentIndexes.get(componentKey);
    if (componentIndex === undefined) {
      componentIndex = components.push(component) - 1;
      componentIndexes.set(componentKey, componentIndex);
    }

    const kitKey = JSON.stringify([name, years, kind]);
    if (!platforms.has(platform)) platforms.set(platform, new Map());
    const kits = platforms.get(platform)!;
    if (!kits.has(kitKey)) kits.set(kitKey, { name, years, kind, components: [] });
    kits.get(kitKey)!.components.push(componentIndex);
    rows++;
  }
}

const models = [...platforms.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
const kits = models.reduce((total, [, groups]) => total + groups.size, 0);
const modelJson = models.map(([name, groups]) =>
  `    { "name": ${JSON.stringify(name)}, "kits": [\n${[...groups.values()].map(kit => "      " + JSON.stringify(kit)).join(",\n")}\n    ] }`
).join(",\n");
const componentJson = components.map((component) => "    " + JSON.stringify(component)).join(",\n");
writeFileSync(new URL("../src/data/kits.json", import.meta.url), `{\n  "models": [\n${modelJson}\n  ],\n  "components": [\n${componentJson}\n  ]\n}\n`);
console.log(`${models.length} plataformas, ${kits} kits y ${rows} filas de componentes importadas.`);
