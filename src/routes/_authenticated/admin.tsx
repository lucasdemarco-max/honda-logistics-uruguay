import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  normalizeImportValue,
  parseImportRow,
  validateDuplicateSkus,
  type CatalogLookup,
  type ImportRow,
} from "@/lib/admin-import";

interface ImportRecord {
  rowNumber: number;
  record: Record<string, unknown>;
}

const chunksOf = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Ocurrió un error inesperado";
};

const modelNameFromRecord = (record: Record<string, unknown>) => {
  const entry = Object.entries(record).find(([key]) =>
    ["modelo", "model", "modelname", "modelid"].includes(normalizeImportValue(key)),
  );
  return String(entry?.[1] ?? "").trim();
};

const modelSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const modelDisplayName = (name: string) => {
  const names: Record<string, string> = {
    ridgeline: "Ridgeline",
    "zr-v": "ZR-V",
    odyssey: "Odyssey",
    "type-r": "Type-R",
  };
  return names[modelSlug(name)] ?? name;
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel administrativo — Honda Logistics" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_staff", {
      _user_id: (context as { user: { id: string } }).user.id,
    });
    if (!data) throw redirect({ to: "/cuenta" });
  },
  component: Admin,
});

function Admin() {
  const [categories, setCategories] = useState<CatalogLookup[]>([]);
  const [models, setModels] = useState<CatalogLookup[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(() => rows.filter((row) => !row.error), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => row.error), [rows]);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      setLookupsLoading(true);
      setLookupsError(null);
      try {
        const [categoryResult, modelResult] = await Promise.all([
          supabase.from("categories").select("id, name, slug").order("sort_order"),
          supabase.from("vehicle_models").select("id, name, slug").order("sort_order"),
        ]);
        if (categoryResult.error) throw categoryResult.error;
        if (modelResult.error) throw modelResult.error;
        if (!active) return;
        setCategories(categoryResult.data);
        setModels(modelResult.data);
      } catch (error) {
        if (active) setLookupsError(errorMessage(error));
      } finally {
        if (active) setLookupsLoading(false);
      }
    };

    void loadLookups();
    return () => {
      active = false;
    };
  }, []);

  const downloadTemplate = () => {
    try {
      const headers = [
        "SKU",
        "Nombre",
        "Categoría",
        "Subcategoría Filtros",
        "Código Honda",
        "Descripción",
        "Precio UYU",
        "Stock",
        "Disponibilidad",
        "Activo",
        "Modelo",
        "Año Desde",
        "Año Hasta",
        "Notas Compatibilidad",
      ];
      const productsSheet = XLSX.utils.aoa_to_sheet([headers]);
      productsSheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 2, 18) }));

      const instructionRows: (string | number)[][] = [
        ["Plantilla de productos Honda Logistics"],
        ["Ingresá una fila por producto y repetí el SKU cuando tenga más de un modelo compatible."],
        ["Las filas con el mismo SKU deben repetir los mismos datos del producto."],
        ["Si el precio cambia entre filas del mismo SKU, se usará el precio más alto."],
        [
          "Dejá Modelo, Año Desde y Año Hasta vacíos si el producto no tiene compatibilidad específica.",
        ],
        ["Un SKU repetido sin modelo y con modelo se considera un error."],
        ["Las celdas vacías de Precio UYU o Stock se guardan como sin dato."],
        [
          "La base actual no guarda subcategorías por separado; se importarán bajo la categoría general Filtros.",
        ],
        ["Los modelos de la planilla que aún no existan se agregarán al catálogo si tenés permiso."],
        [],
        ["Categorías disponibles"],
        ...categories.map((category) => [category.name, category.slug]),
        [],
        ["Modelos disponibles"],
        ...models.map((model) => [model.name, model.slug]),
        [],
        ["Disponibilidades", "en stock", "pocas unidades", "a pedido", "sin stock", "consultar"],
        ["Activo", "sí o no"],
      ];
      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionRows);
      instructionsSheet["!cols"] = [
        { wch: 52 },
        { wch: 28 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, productsSheet, "Productos");
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones");
      XLSX.writeFile(workbook, "plantilla-productos-honda.xlsx");
    } catch (error) {
      toast.error(`No pudimos descargar la plantilla: ${errorMessage(error)}`);
    }
  };

  const readFile = async (file: File) => {
    setImporting(true);
    setRows([]);
    setFileName(file.name);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
        throw new Error("Elegí un archivo .xlsx, .xls o .csv");
      }
      if (!categories.length || !models.length) {
        throw new Error("No pudimos cargar las categorías y modelos para validar el archivo");
      }

      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no contiene hojas para importar");
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) throw new Error("No pudimos leer la primera hoja del archivo");

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
      });
      const headers = (matrix[0] ?? []).map((value) => String(value ?? "").trim());
      if (
        !headers.some((header) =>
          ["sku", "codigo", "codigosku"].includes(normalizeImportValue(header)),
        )
      ) {
        throw new Error("No encontramos una columna SKU en la primera fila");
      }
      if (
        !headers.some((header) =>
          ["nombre", "nombreproducto", "producto", "name"].includes(normalizeImportValue(header)),
        )
      ) {
        throw new Error("No encontramos una columna Nombre en la primera fila");
      }

      const records: ImportRecord[] = matrix
        .slice(1)
        .map((cells, index) => {
          const record: Record<string, unknown> = {};
          headers.forEach((header, columnIndex) => {
            if (header) record[header] = cells[columnIndex] ?? "";
          });
          return { rowNumber: index + 2, record };
        })
        .filter(({ record }) =>
          Object.values(record).some((value) => String(value ?? "").trim() !== ""),
        );

      if (!records.length) throw new Error("La hoja no contiene filas de productos");

      const sourceModelNames = [
        ...new Set(records.map(({ record }) => modelNameFromRecord(record)).filter(Boolean)),
      ];
      const missingModels = sourceModelNames.filter(
        (name) =>
          !models.some((model) =>
            [model.name, model.slug].some(
              (value) => normalizeImportValue(value) === normalizeImportValue(name),
            ),
          ),
      );
      let availableModels = models;
      if (missingModels.length > 0) {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userResult.user) throw new Error("Iniciá sesión para agregar modelos al catálogo");
        const { data: canManageCatalog, error: permissionError } = await supabase.rpc(
          "has_permission",
          { _user_id: userResult.user.id, _perm: "catalogo" },
        );
        if (permissionError) throw permissionError;
        if (!canManageCatalog)
          throw new Error("Tu cuenta no tiene permisos para agregar modelos al catálogo");

        const { error: insertModelsError } = await supabase.from("vehicle_models").upsert(
          missingModels.map((name, index) => ({
            name: modelDisplayName(name),
            slug: modelSlug(name),
            sort_order: 100 + index,
          })),
          { onConflict: "slug" },
        );
        if (insertModelsError) throw insertModelsError;

        const { data: refreshedModels, error: modelsError } = await supabase
          .from("vehicle_models")
          .select("id, name, slug")
          .order("sort_order");
        if (modelsError) throw modelsError;
        availableModels = refreshedModels;
        setModels(refreshedModels);
      }

      const parsedRows = records.map(({ record, rowNumber }) =>
        parseImportRow(record, rowNumber, categories, availableModels),
      );
      const validatedRows = validateDuplicateSkus(parsedRows);
      setRows(validatedRows);

      const invalidCount = validatedRows.filter((row) => row.error).length;
      if (invalidCount > 0) {
        toast.error(`Encontramos ${invalidCount} filas con errores. Corregilas antes de importar.`);
      } else {
        toast.success(`${validatedRows.length} filas listas para revisar.`);
      }
    } catch (error) {
      toast.error(`No pudimos leer el archivo: ${errorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  };

  const importRows = async () => {
    if (importing || validRows.length === 0 || invalidRows.length > 0) return;
    setImporting(true);

    let savedProductCount = 0;
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userResult.user) throw new Error("Iniciá sesión para importar productos");

      const { data: canManageCatalog, error: permissionError } = await supabase.rpc(
        "has_permission",
        {
          _user_id: userResult.user.id,
          _perm: "catalogo",
        },
      );
      if (permissionError) throw permissionError;
      if (!canManageCatalog)
        throw new Error("Tu cuenta no tiene permisos para administrar el catálogo");

      const rowsBySku = new Map<string, ImportRow[]>();
      for (const row of validRows) {
        const group = rowsBySku.get(row.sku) ?? [];
        group.push(row);
        rowsBySku.set(row.sku, group);
      }

      const productRows = [...rowsBySku.values()].map((group) => {
        const row = group[0];
        if (!row) throw new Error("No pudimos preparar una fila de producto");
        return {
          sku: row.sku,
          name: row.name,
          category_id: row.categoryId,
          honda_code: row.hondaCode || null,
          description: row.description || null,
          price_uyu: row.price,
          stock: row.stock,
          availability: row.availability,
          active: row.active,
          is_demo: false,
        };
      });

      const savedProducts: { id: string; sku: string }[] = [];
      for (const batch of chunksOf(productRows, 200)) {
        const { data, error } = await supabase
          .from("products")
          .upsert(batch, { onConflict: "sku" })
          .select("id, sku");
        if (error) throw error;
        savedProducts.push(...data);
        savedProductCount = savedProducts.length;
      }

      const productIdBySku = new Map(savedProducts.map((product) => [product.sku, product.id]));
      if (productIdBySku.size !== rowsBySku.size) {
        throw new Error("No pudimos confirmar el guardado de todos los productos");
      }

      const productIds = savedProducts.map((product) => product.id);
      for (const batch of chunksOf(productIds, 100)) {
        const { error } = await supabase
          .from("product_compatibilities")
          .delete()
          .in("product_id", batch);
        if (error) throw error;
      }

      const compatibilityRows = new Map<
        string,
        {
          product_id: string;
          model_id: string;
          year_from: number;
          year_to: number;
          notes: string | null;
        }
      >();
      for (const row of validRows) {
        if (!row.modelId) continue;
        const productId = productIdBySku.get(row.sku);
        if (!productId)
          throw new Error(`No encontramos el producto ${row.sku} después de guardarlo`);
        const compatibility = {
          product_id: productId,
          model_id: row.modelId,
          year_from: row.yearFrom,
          year_to: row.yearTo,
          notes: row.compatibilityNotes || null,
        };
        const key = JSON.stringify(compatibility);
        compatibilityRows.set(key, compatibility);
      }

      const compatibilityValues = [...compatibilityRows.values()];
      for (const batch of chunksOf(compatibilityValues, 200)) {
        const { error } = await supabase.from("product_compatibilities").insert(batch);
        if (error) throw error;
      }

      toast.success(
        `Importación completa: ${savedProducts.length} productos y ${compatibilityValues.length} compatibilidades.`,
      );
    } catch (error) {
      const detail = errorMessage(error);
      toast.error(
        savedProductCount > 0
          ? `Se guardaron ${savedProductCount} productos, pero no se completó toda la importación. Podés volver a importar el mismo archivo. ${detail}`
          : `No pudimos importar los productos: ${detail}`,
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Administración" title="Panel administrativo" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold uppercase">Importar productos desde Excel</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cargá .xlsx, .xls o CSV. Repetí el SKU en una fila por modelo compatible y mantené
                iguales los datos del producto en esas filas. Para SKU repetidos con distintos
                precios se conserva el más alto; los modelos faltantes se agregan al catálogo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              disabled={lookupsLoading || Boolean(lookupsError)}
            >
              <Download /> Descargar plantilla
            </Button>
          </div>

          {lookupsError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              No pudimos cargar las categorías y modelos: {lookupsError}. Recargá la página e
              intentá nuevamente.
            </p>
          )}
          {lookupsLoading && (
            <p className="mt-4 text-sm text-muted-foreground">Cargando categorías y modelos…</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
              disabled={importing || lookupsLoading || Boolean(lookupsError)}
              className="max-w-md"
              aria-label="Archivo de productos"
            />
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Categorías y modelos deben existir en el sistema. Las celdas vacías de precio o stock se
            guardan sin dato.
          </p>

          {rows.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Vista previa: {validRows.length} válidas · {invalidRows.length} con errores
                </p>
                <Button
                  type="button"
                  onClick={() => void importRows()}
                  disabled={importing || validRows.length === 0 || invalidRows.length > 0}
                >
                  <Upload /> {importing ? "Importando…" : "Importar productos"}
                </Button>
              </div>
              {invalidRows.length > 0 && (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  Corregí todas las filas con errores y volvé a cargar el archivo para habilitar la
                  importación.
                </p>
              )}
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
                  {rows.slice(0, 100).map((row) => (
                    <TableRow key={`${row.sku}-${row.rowNumber}`}>
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
                <p className="mt-3 text-xs text-muted-foreground">
                  Se muestran las primeras 100 filas de la vista previa.
                </p>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Las demás pantallas administrativas (clientes, casos, presupuestos, marcas, titularidad y
          auditoría) siguen pendientes de construir.
        </p>
      </div>
    </>
  );
}
