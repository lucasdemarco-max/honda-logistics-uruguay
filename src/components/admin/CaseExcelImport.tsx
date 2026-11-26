import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/lib/auth";
import { CASE_SOURCE_NAME, parseCaseWorkbook, type CaseSnapshot } from "@/lib/customer-cases";
import type { Json } from "@/integrations/supabase/types";

export function CaseExcelImport() {
  const { data: access } = useAccess();
  const [source, setSource] = useState(CASE_SOURCE_NAME);
  const [records, setRecords] = useState<CaseSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  if (!access?.isAdmin) return null;

  const chooseFile = async (file: File) => {
    setRecords([]);
    setSource(file.name);
    if (!/\\.xlsx?$/i.test(file.name)) {
      toast.error("Seleccioná un archivo Excel .xlsx o .xls");
      return;
    }
    try {
      const cases = parseCaseWorkbook(await file.arrayBuffer(), file.name);
      setRecords(cases);
      toast.success(`${cases.length} casos detectados. Revisá y confirmá la actualización.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el Excel");
    }
  };

  const upload = async () => {
    if (!records.length || loading) return;
    setLoading(true);
    let completed = 0;
    try {
      for (let index = 0; index < records.length; index += 100) {
        const batch = records.slice(index, index + 100);
        // Admin-only RPC checks the server-side role; no public storage or JSON data file.
        const { data, error } = await supabase.rpc("import_customer_case_snapshots", {
          _rows: batch as unknown as Json,
        });
        if (error) throw error;
        completed += data ?? 0;
      }
      toast.success(`${completed} casos actualizados desde ${source}.`);
      setRecords([]);
    } catch (error) {
      toast.error(`Importación incompleta (${completed} casos). ${error instanceof Error ? error.message : "Reintentá."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border bg-card p-6 shadow-card">
      <h2 className="text-2xl font-semibold uppercase">Actualizar seguimiento de casos desde Excel</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Archivo de referencia: <span className="font-medium">{CASE_SOURCE_NAME}</span>.
        Para futuras actualizaciones seleccioná el nuevo archivo en este mismo apartado.
        El Excel permanece privado: se procesan los casos en el panel administrativo,
        nunca en la carpeta pública del sitio ni en GitHub.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Input type="file" accept=".xlsx,.xls" className="max-w-md" aria-label="Excel de casos de clientes"
          disabled={loading} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void chooseFile(file);
            event.target.value = "";
          }} />
        {records.length > 0 && (
          <Button disabled={loading} onClick={() => void upload()}>
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Actualizando…" : `Actualizar ${records.length} casos`}
          </Button>
        )}
      </div>
      {records.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Archivo: {source}. {records.length} casos y {records.reduce((sum, c) => sum + c.lines.length, 0)} líneas de repuestos.
          Se conserva un único caso por número y sus líneas se reemplazan con la última versión importada.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        El importador acepta los cinco dígitos actuales de Caso Min y los normaliza a seis
        agregando un cero a la izquierda. Para publicar los datos privados se requiere
        la migración SQL de customer_case_imports y una cuenta de cliente habilitada con chasis verificado.
      </p>
    </section>
  );
}
