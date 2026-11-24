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
import { prepareImportRecords, type CatalogLookup } from "@/lib/admin-import";
import {
  readImportWorkbook,
  validateImportFile,
  type ImportWorkbookResult,
} from "@/lib/import-workbook";
import {
  applyImportSafety,
  CatalogImportError,
  executeCatalogImport,
  type ImportProgress,
} from "@/lib/catalog-import";
import { createImportTemplate } from "@/lib/import-template";
import { createCatalogImportStore } from "@/lib/catalog-import-store";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";
const emptyProgress = (): ImportProgress => ({
  categories: 0,
  models: 0,
  createdProducts: 0,
  updatedProducts: 0,
  compatibilities: 0,
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel administrativo — Honda Logistics" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.rpc("is_staff", {
      _user_id: (context as { user: { id: string } }).user.id,
    });
    if (error) throw error;
    if (!data) throw redirect({ to: "/cuenta" });
  },
  component: Admin,
});

function Admin() {
  const store = useMemo(() => createCatalogImportStore(supabase), []);
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<CatalogLookup[]>([]);
  const [models, setModels] = useState<CatalogLookup[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<ImportWorkbookResult | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(emptyProgress);
  const [page, setPage] = useState(0);
  const busy = reading || importing;
  const records = useMemo(
    () =>
      workbook?.records.filter((row) => row.sheetName && selectedSheets.includes(row.sheetName)) ??
      [],
    [workbook, selectedSheets],
  );
  const plan = useMemo(
    () => applyImportSafety(prepareImportRecords(records, categories, models)),
    [records, categories, models],
  );
  const invalidRows = plan.rows.filter((row) => row.error);
  const uniqueSkus = new Set(plan.rows.map((row) => row.sku)).size;
  const pageSize = 50;
  const pageCount = Math.ceil(plan.rows.length / pageSize);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await store.authorize();
        const lookups = await store.getLookups();
        if (!active) return;
        setCategories(lookups.categories);
        setModels(lookups.models);
      } catch (error) {
        if (active) setLookupsError(errorMessage(error));
      } finally {
        if (active) setLookupsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [store]);

  const downloadTemplate = () => {
    XLSX.writeFile(createImportTemplate(categories, models), "plantilla-catalogo-honda.xlsx");
  };

  const readFile = async (file: File) => {
    setReading(true);
    setWorkbook(null);
    setSelectedSheets([]);
    setFileError(null);
    setResult(null);
    setProgress(emptyProgress());
    setFileName(file.name);
    setPage(0);
    try {
      validateImportFile(file.name, file.size);
      const parsed = readImportWorkbook(
        XLSX.read(await file.arrayBuffer(), { type: "array", raw: true, cellNF: true }),
      );
      setWorkbook(parsed);
      setSelectedSheets(parsed.sheets.map((sheet) => sheet.name));
    } catch (error) {
      setFileError(errorMessage(error));
    } finally {
      setReading(false);
    }
  };

  const downloadErrors = () => {
    const file = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Hoja", "Fila", "SKU", "Error"],
      ...invalidRows.map((row) => [row.sheetName ?? "", row.rowNumber, row.sku, row.error ?? ""]),
    ]);
    sheet["!cols"] = [{ wch: 25 }, { wch: 9 }, { wch: 22 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(file, sheet, "Errores");
    XLSX.writeFile(file, "errores-importacion-honda.xlsx");
  };

  const importRows = async () => {
    if (busy || !records.length || invalidRows.length || lookupsError) return;
    setImporting(true);
    setResult(null);
    setProgress(emptyProgress());
    let succeeded = false;
    try {
      const saved = await executeCatalogImport(records, store, setProgress);
      const message = `Importación completa: ${saved.createdProducts} productos nuevos, ${saved.updatedProducts} actualizados y ${saved.compatibilities} aplicaciones agregadas. Se conservaron las aplicaciones anteriores.`;
      setResult(message);
      toast.success(message);
      succeeded = true;
    } catch (error) {
      const saved = error instanceof CatalogImportError ? error.progress : emptyProgress();
      const changed = Object.values(saved).some((value) => value > 0);
      const message = changed
        ? `Importación incompleta: ${saved.categories} categorías, ${saved.models} modelos, ${saved.createdProducts + saved.updatedProducts} productos y ${saved.compatibilities} aplicaciones guardadas. ${errorMessage(error)} Los cambios confirmados se conservan. Revisá el resultado y reintentá el mismo archivo.`
        : `No se confirmaron cambios. ${errorMessage(error)} Si hubo un corte de conexión, recargá antes de reintentar.`;
      setResult(message);
      toast.error(message);
    } finally {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-meta"] }),
      ]);
      try {
        const lookups = await store.getLookups();
        setCategories(lookups.categories);
        setModels(lookups.models);
      } catch {
        setLookupsError(
          "No se pudieron actualizar las referencias. Recargá la página antes de volver a importar.",
        );
      }
      if (succeeded) {
        setWorkbook(null);
        setSelectedSheets([]);
      }
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Catálogo e importación"
        description="Actualizá repuestos y aplicaciones por modelo y categoría desde una o varias hojas de Excel."
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-4 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold uppercase">Importar catálogo</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Cargá archivos .xlsx, .xls o .csv de cualquier categoría. Primero revisá las hojas,
                las aplicaciones y los cambios propuestos; después confirmá el guardado.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              disabled={busy || lookupsLoading || Boolean(lookupsError)}
            >
              <Download /> Descargar plantilla
            </Button>
          </div>
          {lookupsError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {lookupsError}
            </p>
          )}
          {lookupsLoading && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Verificando permisos y referencias del catálogo…
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              aria-label="Archivo de catálogo"
              disabled={busy || lookupsLoading || Boolean(lookupsError)}
              className="max-w-md"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
            />
            {fileName && (
              <span className="break-all text-sm text-muted-foreground">{fileName}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Hasta 20 MB y 20.000 filas. Las celdas opcionales vacías conservan los datos existentes.
            Las aplicaciones anteriores permanecen guardadas.
          </p>
          {reading && (
            <p role="status" className="mt-4 text-sm">
              Leyendo hojas y validando encabezados…
            </p>
          )}
          {fileError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {fileError}
            </p>
          )}
          {workbook && (
            <>
              <fieldset disabled={busy} className="mt-6 rounded-lg border bg-muted/30 p-4">
                <legend className="px-1 text-sm font-medium">Hojas que se importarán</legend>
                <div className="flex flex-wrap gap-4">
                  {workbook.sheets.map((sheet) => (
                    <label key={sheet.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSheets.includes(sheet.name)}
                        onChange={(event) => {
                          setSelectedSheets((previous) =>
                            event.target.checked
                              ? [...previous, sheet.name]
                              : previous.filter((name) => name !== sheet.name),
                          );
                          setPage(0);
                          setResult(null);
                        }}
                      />
                      {sheet.name} · {sheet.rowCount} filas · encabezado en fila {sheet.headerRow}
                    </label>
                  ))}
                </div>
                {workbook.ignoredSheets.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Hojas auxiliares omitidas: {workbook.ignoredSheets.join(", ")}.
                  </p>
                )}
              </fieldset>
              {(plan.newCategories.length > 0 || plan.newModels.length > 0) && (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p>Se crearán estas referencias al confirmar:</p>
                  {plan.newCategories.length > 0 && (
                    <p className="mt-2">
                      Categorías:{" "}
                      {plan.newCategories
                        .map((value) => `${value.name} (${value.slug})`)
                        .join(" · ")}
                    </p>
                  )}
                  {plan.newModels.length > 0 && (
                    <p className="mt-2">
                      Modelos:{" "}
                      {plan.newModels.map((value) => `${value.name} (${value.slug})`).join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {plan.warnings.length > 0 && (
                <div role="status" className="mt-4 rounded-lg border p-4 text-sm">
                  <p>Observaciones para revisar:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {plan.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm">
                  {uniqueSkus} productos · {plan.rows.length} filas · {invalidRows.length} con
                  errores
                </p>
                <div className="flex flex-wrap gap-2">
                  {invalidRows.length > 0 && (
                    <Button variant="outline" type="button" onClick={downloadErrors}>
                      <Download /> Descargar errores
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => void importRows()}
                    disabled={
                      busy || !records.length || invalidRows.length > 0 || Boolean(lookupsError)
                    }
                  >
                    <Upload />
                    {importing ? "Guardando…" : "Confirmar importación"}
                  </Button>
                </div>
              </div>
              {!records.length && (
                <p role="status" className="my-3 text-sm text-muted-foreground">
                  Seleccioná al menos una hoja con productos.
                </p>
              )}
              {invalidRows.length > 0 && (
                <p role="alert" className="mb-4 text-sm text-destructive">
                  Corregí todas las filas indicadas y volvé a cargar el archivo. La vista previa no
                  guarda cambios.
                </p>
              )}
              {plan.rows.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hoja / fila</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>SKU / producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Modelo / años</TableHead>
                      <TableHead>Precio UYU</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                      <TableRow key={`${row.sheetName}-${row.rowNumber}`}>
                        <TableCell>
                          {row.sheetName} · {row.rowNumber}
                        </TableCell>
                        <TableCell
                          className={row.error ? "min-w-52 text-destructive" : "text-success"}
                        >
                          {row.error ?? "Válida"}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{row.sku}</span>
                          <p>{row.name}</p>
                        </TableCell>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>
                          {row.modelId
                            ? `${row.modelName} · ${row.yearFrom}–${row.yearTo}`
                            : "Sin aplicación informada"}
                        </TableCell>
                        <TableCell>
                          {row.provided.price ? row.price : "Conservar / sin dato"}
                        </TableCell>
                        <TableCell>
                          {row.provided.stock ? row.stock : "Conservar / sin dato"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {pageCount > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {page + 1} de {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
          {importing && (
            <p role="status" className="mt-5 text-sm">
              Guardados: {progress.createdProducts + progress.updatedProducts} productos ·{" "}
              {progress.compatibilities} aplicaciones. Mantené esta página abierta.
            </p>
          )}
          {result && (
            <p role="status" className="mt-5 rounded-lg border bg-muted/30 p-4 text-sm">
              {result}
            </p>
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
