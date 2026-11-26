import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { prepareImport, type CatalogLookup, type ImportRecord } from "@/lib/admin-import";
import { detectImportSheet, readImportSheet } from "@/lib/import-workbook";
import {
  executeImport,
  ImportExecutionError,
  loadImportLookups,
  type ImportProgress,
} from "@/lib/admin-import-service";

const errorMessage = (error: unknown) =>
  error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
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

export function Admin() {
  const queryClient = useQueryClient();
  const [lookups, setLookups] = useState<{ categories: CatalogLookup[]; models: CatalogLookup[] }>({
    categories: [],
    models: [],
  });
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportProgress | null>(null);
  const preview = useMemo(
    () => prepareImport(records, lookups.categories, lookups.models),
    [records, lookups],
  );
  const invalidRows = preview.rows.filter((row) => row.error);
  const validRows = preview.rows.filter((row) => !row.error);

  useEffect(() => {
    let active = true;
    void loadImportLookups(supabase)
      .then((data) => {
        if (active) setLookups(data);
      })
      .catch((error) => {
        if (active) setLookupsError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLookupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const downloadTemplate = () => {
    const headers = [
      "SKU",
      "Name",
      "CategoryID",
      "CategoryName",
      "HondaCode",
      "Description",
      "Price",
      "Stock",
      "Availability",
      "Active",
      "ModelID",
      "ModelName",
      "YearFrom",
      "YearTo",
      "CompatibilityNotes",
    ];
    const productsSheet = XLSX.utils.aoa_to_sheet([headers]);
    productsSheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 2, 18) }));
    const instructions = XLSX.utils.aoa_to_sheet([
      ["Plantilla universal Honda Logistics"],
      ["Una fila por compatibilidad. Repetí SKU para agregar modelos o intervalos de años."],
      ["SKU y Name son obligatorios, junto con CategoryID o CategoryName."],
      ["ModelID y CategoryID aceptan un UUID existente o un identificador de catálogo (slug)."],
      [
        "Identificadores nuevos: letras sin tildes, números, puntos, guiones o guiones bajos; agregá su nombre en ModelName/CategoryName.",
      ],
      ["Un UUID desconocido se rechaza. Un ID y un nombre contradictorios se rechazan."],
      ["Se crean categorías y modelos nuevos al confirmar, con los permisos del usuario."],
      [
        "No se deduce categoría por nombre de producto. Las subcategorías explícitas antiguas se conservan como categorías.",
      ],
      ["ModelID/ModelName requiere YearFrom y YearTo; sin modelo no se afirma compatibilidad."],
      [
        "Dejá vacíos los campos opcionales para conservar los datos existentes. Cero explícito actualiza a cero.",
      ],
      [
        "Las compatibilidades existentes se conservan; esta importación solamente agrega aplicaciones.",
      ],
      [
        "Con el mismo SKU, el mayor Price se utiliza si hay distintos precios; otros datos no vacíos deben coincidir.",
      ],
      ["Guardá SKU y códigos como texto. Reemplazá fórmulas por valores antes de importar."],
      [
        "Se importa la hoja seleccionada. Admitimos .xlsx, .xls y .csv (20.000 filas y 10 MB por archivo).",
      ],
      ["Disponibilidad: en_stock, pocas_unidades, a_pedido, sin_stock, consultar. Activo: sí/no."],
      [
        "Importación por pasos, sin transacción global: un error informa el avance para reintentar.",
      ],
    ]);
    instructions["!cols"] = [{ wch: 120 }];
    const cats = XLSX.utils.json_to_sheet(
      lookups.categories.map((item) => ({
        CategoryID: item.id,
        CategoryName: item.name,
        Slug: item.slug,
      })),
    );
    const models = XLSX.utils.json_to_sheet(
      lookups.models.map((item) => ({ ModelID: item.id, ModelName: item.name, Slug: item.slug })),
    );
    const file = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(file, productsSheet, "Productos");
    XLSX.utils.book_append_sheet(file, instructions, "Instrucciones");
    XLSX.utils.book_append_sheet(file, cats, "Categorías");
    XLSX.utils.book_append_sheet(file, models, "Modelos");
    XLSX.writeFile(file, "plantilla-catalogo-honda.xlsx");
  };

  const selectSheet = (file: XLSX.WorkBook, name: string) => {
    setSheetName(name);
    setRecords([]);
    setFileError(null);
    setResult(null);
    try {
      setRecords(readImportSheet(file, name));
    } catch (error) {
      setFileError(errorMessage(error));
    }
  };
  const readFile = async (file: File) => {
    setBusy(true);
    setRecords([]);
    setWorkbook(null);
    setFileError(null);
    setResult(null);
    setFileName(file.name);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error("Elegí un archivo .xlsx, .xls o .csv");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("El archivo supera 10 MB; dividilo antes de importar");
      const parsed = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellFormula: true,
        cellText: true,
        cellNF: true,
        raw: true,
      });
      if (!parsed.SheetNames.length) throw new Error("El archivo no contiene hojas");
      setWorkbook(parsed);
      selectSheet(parsed, detectImportSheet(parsed));
    } catch (error) {
      setFileError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const importRows = async () => {
    if (busy || !validRows.length || invalidRows.length) return;
    setBusy(true);
    setFileError(null);
    setResult(null);
    try {
      const progress = await executeImport(supabase, records);
      setResult(progress);
      toast.success(
        `Importación completa: ${progress.products} productos y ${progress.compatibilities} compatibilidades nuevas.`,
      );
      // Refresh both catalogue metadata and product queries after successful writes.
      await queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith("catalog"),
      });
      try {
        setLookups(await loadImportLookups(supabase));
      } catch {
        /* Import completed; a later reload refreshes lookup labels. */
      }
    } catch (error) {
      const progress = error instanceof ImportExecutionError ? error.progress : null;
      const writes = progress && Object.values(progress).some((count) => count > 0);
      setFileError(
        writes
          ? `Importación parcial: ${progress.products} productos, ${progress.categories} categorías, ${progress.models} modelos y ${progress.compatibilities} compatibilidades guardados. Podés reintentar el archivo; no se borraron aplicaciones. ${errorMessage(error)}`
          : `No se completó la importación: ${errorMessage(error)}`,
      );
      if (writes)
        await queryClient.invalidateQueries({
          predicate: (query) => String(query.queryKey[0]).startsWith("catalog"),
        });
    } finally {
      setBusy(false);
    }
  };
  const downloadErrors = () => {
    const file = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      file,
      XLSX.utils.json_to_sheet(
        invalidRows.map((row) => ({ Fila: row.rowNumber, SKU: row.sku, Error: row.error })),
      ),
      "Errores",
    );
    XLSX.writeFile(file, "errores-importacion-honda.xlsx");
  };

  return (
    <>
      <PageHeader eyebrow="Administración" title="Panel administrativo" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold uppercase">Importar catálogo desde Excel</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cargá productos de cualquier categoría y modelo. Revisá la hoja y las altas nuevas
                antes de confirmar la importación.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              disabled={lookupsLoading || Boolean(lookupsError) || busy}
            >
              <Download /> Descargar plantilla
            </Button>
          </div>
          {lookupsError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              No pudimos cargar categorías y modelos: {lookupsError}. Recargá la página.
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
              disabled={busy || lookupsLoading || Boolean(lookupsError)}
              className="max-w-md"
              aria-label="Archivo de productos"
            />
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            {workbook && (
              <div className="flex items-center gap-2">
                <label htmlFor="import-sheet" className="text-sm">
                  Hoja
                </label>
                <select
                  id="import-sheet"
                  value={sheetName}
                  disabled={busy}
                  onChange={(event) => selectSheet(workbook, event.target.value)}
                  className="rounded-md border bg-card px-3 py-2 text-sm"
                >
                  {workbook.SheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            La vista previa no guarda cambios. ModelID/CategoryID admiten IDs existentes o
            identificadores de catálogo. Los campos opcionales vacíos conservan sus valores; un cero
            explícito los actualiza. Las compatibilidades existentes se mantienen.
          </p>
          {fileError && (
            <p role="alert" className="mt-4 whitespace-pre-wrap text-sm text-destructive">
              {fileError}
            </p>
          )}
          {result && (
            <p role="status" className="mt-4 rounded-md bg-muted p-3 text-sm">
              Importación completa: {result.products} productos, {result.categories} categorías
              nuevas, {result.models} modelos nuevos, {result.compatibilities} compatibilidades
              agregadas y {result.notes} notas completadas.
            </p>
          )}
          {preview.rows.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Vista previa: {validRows.length} filas válidas · {invalidRows.length} con errores
                  · {new Set(preview.rows.map((row) => row.sku)).size} productos
                </p>
                <Button
                  type="button"
                  onClick={() => void importRows()}
                  disabled={busy || !validRows.length || Boolean(invalidRows.length)}
                >
                  <Upload /> {busy ? "Procesando…" : "Confirmar importación"}
                </Button>
              </div>
              {(preview.newCategories.length > 0 || preview.newModels.length > 0) && (
                <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
                  <p>Se crearán al confirmar:</p>
                  {preview.newCategories.length > 0 && (
                    <p>
                      Categorías:{" "}
                      {preview.newCategories
                        .map((item) => `${item.name} (${item.slug})`)
                        .join(", ")}
                    </p>
                  )}
                  {preview.newModels.length > 0 && (
                    <p>
                      Modelos:{" "}
                      {preview.newModels.map((item) => `${item.name} (${item.slug})`).join(", ")}
                    </p>
                  )}
                </div>
              )}
              <p className="mb-3 text-xs text-muted-foreground">
                Cada SKU se guarda una vez y agrega las aplicaciones de sus filas. Con precios
                distintos para un mismo SKU, se utiliza el mayor. Los demás datos no vacíos deben
                coincidir.
              </p>
              {invalidRows.length > 0 && (
                <div className="mb-4 rounded-md border border-destructive/30 p-3">
                  <p role="alert" className="text-sm text-destructive">
                    Corregí las filas con errores y volvé a cargar el archivo.
                  </p>
                  <ul className="my-2 list-inside list-disc text-xs text-destructive">
                    {invalidRows.slice(0, 20).map((row) => (
                      <li key={row.rowNumber}>{row.error}</li>
                    ))}
                  </ul>
                  {invalidRows.length > 20 && (
                    <p className="text-xs">Mostrando 20 de {invalidRows.length} errores.</p>
                  )}
                  <Button size="sm" variant="outline" onClick={downloadErrors}>
                    <Download /> Descargar errores
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila / estado</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Modelo / años</TableHead>
                    <TableHead>Precio UYU</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 100).map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className={row.error ? "text-destructive" : "text-success"}>
                        {row.rowNumber} · {row.error ?? "Válida"}
                      </TableCell>
                      <TableCell className="font-mono">{row.sku}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>
                        {row.categoryName}
                        {row.category?.isNew ? " · Nueva" : ""}
                      </TableCell>
                      <TableCell>
                        {row.model
                          ? `${row.modelName} · ${row.yearFrom}–${row.yearTo}${row.model.isNew ? " · Nuevo" : ""}`
                          : "Sin nueva aplicación"}
                      </TableCell>
                      <TableCell>{row.provided.price ? row.price : "Conservar"}</TableCell>
                      <TableCell>{row.provided.stock ? row.stock : "Conservar"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rows.length > 100 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Se muestran las primeras 100 filas. Se validan e importan las{" "}
                  {preview.rows.length} filas de la hoja seleccionada.
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
