import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/site/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useAccess } from "@/lib/auth";
import { normalizeCaseMin, type CaseSnapshot } from "@/lib/customer-cases";

export const Route = createFileRoute("/seguimiento")({
  head: () => ({
    meta: [
      { title: "Seguimiento de casos — Honda Logistics" },
      { name: "description", content: "Consultá el seguimiento de los repuestos de tu caso con una cuenta verificada." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Seguimiento,
});

const show = (value: string | null | undefined) => value?.trim() || "No informado";

function Seguimiento() {
  const { user, ready } = useAuth();
  const { data: access } = useAccess();
  const [caseNumber, setCaseNumber] = useState("");
  const [caseResult, setCaseResult] = useState<CaseSnapshot | null>(null);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const authorized = access?.isStaff || access?.profile?.account_status === "habilitada";
  const lookup = async () => {
    const normalized = normalizeCaseMin(caseNumber);
    if (!normalized || !/^\\d{6}$/.test(caseNumber)) {
      setErrorMessage("Ingresá el número de caso de cinco dígitos.");
      return;
    }
    setPending(true);
    setErrorMessage("");
    setSearched(false);
    setCaseResult(null);
    try {
      // Server-side row security restricts results to staff or the account
      // owning the same verified chassis. A case number is not authentication.
      const { data, error } = await supabase.rpc("lookup_customer_case", { _case_min: normalized });
      if (error) throw error;
      if (data && typeof data === "object" && !Array.isArray(data) && "case_min" in data) {
        setCaseResult(data as unknown as CaseSnapshot);
      }
      setSearched(true);
    } catch {
      setErrorMessage("No pudimos consultar el caso. Contactanos para verificar el acceso.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Clientes"
        title="Seguimiento de casos"
        description="Ingresá los cinco dígitos de tu caso. Consultá sus datos generales y el estado individual de cada repuesto."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Verificando sesión…</p>
        ) : !user ? (
          <section className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-xl font-semibold">Ingresá a tu cuenta para consultar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La consulta incluye datos personales y el chasis del vehículo.
              Por seguridad, el número de caso solo no habilita el acceso.
            </p>
            <Button asChild className="mt-5">
              <Link to="/auth" search={{ redirect: "/seguimiento" }}>Ingresar o registrarme</Link>
            </Button>
          </section>
        ) : !authorized ? (
          <section className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-xl font-semibold">Cuenta pendiente de validación</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Para ver los casos necesitamos validar tu cuenta y asociar el chasis a tu vehículo.
            </p>
            <Button asChild className="mt-4"><Link to="/cuenta">Ver mi cuenta</Link></Button>
          </section>
        ) : (
          <>
            <section className="rounded-lg border bg-card p-6 shadow-card">
              <form onSubmit={(event) => { event.preventDefault(); void lookup(); }}>
                <label htmlFor="case-number" className="block text-sm font-semibold">
                  Número de caso (5 dígitos)
                </label>
                <div className="mt-3 flex max-w-md flex-col gap-3 sm:flex-row">
                  <Input id="case-number" type="text" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}
                    placeholder="Ej.: 01043" value={caseNumber}
                    onChange={(event) => { setCaseNumber(event.target.value.replace(/\D/g, "").slice(0, 5)); setSearched(false); }}
                    required autoComplete="off" aria-describedby="case-number-help" />
                  <Button type="submit" disabled={pending || caseNumber.length !== 5}>
                    <Search className="mr-2 h-4 w-4" />
                    {pending ? "Consultando…" : "Consultar caso"}
                  </Button>
                </div>
                <p id="case-number-help" className="mt-2 text-xs text-muted-foreground">
                  Ingresá los cinco dígitos tal como figuran en Caso Min del Excel.
                  Ejemplo: 01043.
                </p>
              </form>
              {errorMessage && <p className="mt-4 text-sm text-destructive" role="alert">{errorMessage}</p>}
              {searched && !caseResult && (
                <p className="mt-4 rounded-lg bg-muted p-4 text-sm" role="status">
                  No encontramos un caso accesible con ese número. Verificá el código y
                  que el vehículo esté asociado a tu cuenta.
                </p>
              )}
            </section>

            {caseResult && (
              <>
                <section aria-labelledby="case-overview" className="rounded-lg border bg-card p-6 shadow-card">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-6 w-6 text-primary" aria-hidden />
                    <h2 id="case-overview" className="text-2xl font-semibold uppercase">Datos del caso</h2>
                  </div>
                  <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ["Nro. de caso (CPED)", caseResult.cped],
                      ["Cliente asociado", caseResult.customer_name],
                      ["Nro. de chasis", caseResult.chassis],
                      ["Modelo del vehículo", caseResult.vehicle_version || caseResult.vehicle_type],
                      ["Asesor asignado", caseResult.requester],
                      ["Sucursal asignada", caseResult.requester_area],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="border-b pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-sm font-medium">{show(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {caseResult.vehicle_type && caseResult.vehicle_version && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Tipo de vehículo (identificador original del Excel): {caseResult.vehicle_type}
                    </p>
                  )}
                </section>

                <section aria-labelledby="case-items" className="space-y-4">
                  <div className="flex items-center gap-3">
                    <PackageSearch className="h-6 w-6 text-primary" aria-hidden />
                    <h2 id="case-items" className="text-2xl font-semibold uppercase">
                      Repuestos involucrados ({caseResult.lines.length})
                    </h2>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {caseResult.lines.map((line, index) => (
                      <article key={`${line.sku}-${index}`} className="rounded-lg border bg-card p-5 shadow-card">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-primary">Código de repuesto</p>
                            <p className="font-mono text-base font-semibold">{show(line.sku)}</p>
                          </div>
                          <span className="rounded bg-muted px-2 py-1 text-xs">Cantidad: {show(line.quantity)}</span>
                        </div>
                        <p className="text-sm font-medium">{show(line.description)}</p>
                        <dl className="mt-4 space-y-3 border-t pt-4 text-sm">
                          {([
                            ["Estado del caso", line.document_status],
                            ["Línea del caso", line.line_status],
                            ["Estado logístico", line.logistics_status],
                            ["Documento relacionado", line.related_document],
                          ] as const).map(([label, value]) => (
                            <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="text-right font-medium">{show(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
