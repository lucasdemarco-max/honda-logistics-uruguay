import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FILTER_SUBCATEGORIES } from "@/lib/filter-categories";

type Availability = "en_stock" | "pocas_unidades" | "a_pedido" | "sin_stock" | "consultar";

interface ImportRow {
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  hondaCode: string;
  description: string;
  price: number | null;
  stock: number | null;
  availability: Availability;
  active: boolean;
  modelId: string | null;
  yearFrom: number;
  yearTo: number;
  compatibilityNotes: string;
  error: string | null;
}

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getValue = (record: Record<string, unknown>, names: string[]) => {
  const aliases = new Set(names.map(normalize));
  const entry = Object.entries(record).find(([key]) => aliases.has(normalize(key)));
  return entry?.[1] ?? "";
};

const textValue = (record: Record<string, unknown>, names: string[]) => {
  const value = getValue(record, names);
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
};

const parseNumber = (value: unknown): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let normalized = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseAvailability = (value: unknown): Availability => {
  const normalized = normalize(value);
  if (["disponible", "enstock"].includes(normalized)) return "en_stock";
  if (["pocasunidades", "ultimasunidades"].includes(normalized)) return "pocas_unidades";
  if (["apedido", "pedido"].includes(normalized)) return "a_pedido";
  if (["sinstock", "agotado"].includes(normalized)) return "sin_stock";
  return "consultar";
};

const parseImportRow = (
  record: Record<string, unknown>,
  index: number,
  categories: { id: string; name: string; slug: string }[],
  models: { id: string; name: string; slug: string }[],
): ImportRow => {
  const sku = textValue(record, ["sku", "codigo sku", "codigo"]);
  const name = textValue(record, ["nombre", "nombre producto", "producto", "name"]);
  const categoryName = textValue(record, ["categoria", "categoría", "category"]);
  const subcategoryName = textValue(record, ["subcategoria", "subcategoría", "subcategoria filtros", "tipo de filtro"]);
  const hondaCode = textValue(record, ["codigo honda", "código honda", "honda code"]);
  const description = textValue(record, ["descripcion", "descripción", "description"]);
  const price = parseNumber(getValue(record, ["precio", "precio uyu", "price", "precio en uyu"]));
  const stockValue = parseNumber(getValue(record, ["stock", "cantidad"]));
  const stock = stockValue === null ? null : Math.trunc(stockValue);
  const activeText = normalize(getValue(record, ["activo", "active"]));
  const active = activeText ? !["no", "0", "false", "inactivo"].includes(activeText) : true;
  const modelName = textValue(record, ["modelo", "model"]);
  const yearFromValue = parseNumber(getValue(record, ["anio desde", "año desde", "year from", "desde"]));
  const yearToValue = parseNumber(getValue(record, ["anio hasta", "año hasta", "year to", "hasta"]));

  const category = categories.find((item) =>
    [item.name, item.slug].some((value) => normalize(value) === normalize(categoryName)),
  );
  const subcategory = subcategoryName
    ? categories.find((item) =>
        [item.name, item.slug].some((value) => normalize(value) === normalize(subcategoryName)),
      )
    : null;
  const model = models.find((item) =>
    [item.name, item.slug].some((value) => normalize(value) === normalize(modelName)),
  );

  const errors: string[] = [];
  if (!sku) errors.push("SKU requerido");
  if (!name) errors.push("Nombre requerido");
  if (!subcategoryName && !categoryName) errors.push("Categoría o subcategoría requerida");
  if (subcategoryName && !subcategory) errors.push(`Subcategoría desconocida: ${subcategoryName}`);
  if (!subcategoryName && categoryName && !category) errors.push(`Categoría desconocida: ${categoryName}`);
  if (textValue(record, ["precio", "precio uyu", "price", "precio en uyu"]) && price === null) errors.push("Precio inválido");
  if (textValue(record, ["stock", "cantidad"]) && stock === null) errors.push("Stock inválido");
  if (modelName && !model) errors.push(`Modelo desconocido: ${modelName}`);
  if (model && (!yearFromValue || !yearToValue)) errors.push("Modelo requiere año desde y año hasta");
  if (model && yearFromValue && yearToValue && yearFromValue > yearToValue) errors.push("Año desde no puede superar año hasta");

  return {
    sku,
    name,
    categoryId: subcategory?.id ?? category?.id ?? null,
    categoryName: subcategory?.name ?? category?.name ?? subcategoryName ?? categoryName,
    hondaCode,
    description,
    price,
    stock,
    availability: parseAvailability(getValue(record, ["disponibilidad", "availability", "estado"])),
    active,
    modelId: model?.id ?? null,
    yearFrom: yearFromValue ?? 1995,
    yearTo: yearToValue ?? new Date().getFullYear() + 1,
    compatibilityNotes: textValue(record, ["notas compatibilidad", "notas", "compatibilidad"]),
    error: errors.length ? `Fila ${index + 2}: ${errors.join("; ")}` : null,
  };
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel administrativo — Honda Logistics" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_staff", { _user_id: (context as { user: { id: string } }).user.id });
    if (!data) throw redirect({ to: "/cuenta" });
  },
  component: Admin,
});

function Admin() {
  return (
    <>
      <PageHeader eyebrow="Administración" title="Panel administrativo" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold uppercase">Importar productos desde Excel</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cargá archivos .xlsx, .xls o CSV. Repetí el SKU en una fila por modelo compatible, manteniendo iguales los datos del producto y cambiando modelo/años.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download /> Descargar plantilla
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
              disabled={importing}
              className="max-w-md"
              aria-label="Archivo de productos"
            />
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Vista previa: {validRows.length} válidas · {invalidRows.length} con errores
                </p>
                <Button type="button" onClick={() => void importRows()} disabled={importing || validRows.length === 0}>
                  <Upload /> {importing ? "Importando…" : "Importar productos"}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Modelo / años</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((row, index) => (
                    <TableRow key={`${row.sku}-${index}`}>
                      <TableCell className={row.error ? "text-destructive" : "text-success"}>
                        {row.error ?? "Válida"}
                      </TableCell>
                      <TableCell className="font-mono">{row.sku}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell>
                        {row.modelId
                          ? `${models.find((model) => model.id === row.modelId)?.name ?? "Modelo"} · ${row.yearFrom}–${row.yearTo}`
                          : "Sin compatibilidad"}
                      </TableCell>
                      <TableCell>{row.price === null ? "No informado" : row.price}</TableCell>
                      <TableCell>{row.stock ?? "No informado"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 100 && (
                <p className="mt-3 text-xs text-muted-foreground">Se muestran las primeras 100 filas de la vista previa.</p>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Las demás pantallas administrativas (clientes, casos, presupuestos, marcas, titularidad y auditoría) siguen pendientes de construir.
        </p>
      </div>
    </>
  );
}
