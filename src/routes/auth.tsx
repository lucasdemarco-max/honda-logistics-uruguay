import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, LoaderCircle, LogIn, MailCheck, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/site/PageHeader";
import { useAuth } from "@/lib/auth";
import { catalogMetaQuery } from "./index";

interface AuthSearch {
  modo?: "registro" | "login" | undefined;
  redirect?: string | undefined;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 2 - 1995 }, (_, i) => CURRENT_YEAR + 1 - i);
const OTHER = "__otro";

/** Only same-origin destinations: an open redirect would send a signed-in customer elsewhere. */
function safeRedirect(redirect: string | undefined): string | null {
  if (!redirect) return null;
  try {
    const url = new URL(redirect, window.location.origin);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    modo: s["modo"] === "registro" ? "registro" : s["modo"] === "login" ? "login" : undefined,
    redirect: str(s["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Ingresar o crear cuenta — Honda Logistics" },
      {
        name: "description",
        content: "Accedé a tu cuenta de Honda Logistics o creala con tus datos y los de tu vehículo. Validamos cada cuenta manualmente.",
      },
      { property: "og:title", content: "Ingresar o crear cuenta — Honda Logistics" },
      {
        property: "og:description",
        content: "Accedé a tu cuenta o creala con tus datos y los de tu vehículo. Validamos cada cuenta manualmente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogMetaQuery),
  component: AuthPage,
});

interface VehicleRow {
  vin: string;
  plate: string;
  model: string;
  other: string;
  year: string;
}

const emptyRow = (): VehicleRow => ({ vin: "", plate: "", model: OTHER, other: "", year: "" });

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AuthPage() {
  const { modo = "login", redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { data: meta } = useSuspenseQuery(catalogMetaQuery);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const goToTarget = () => {
    const target = safeRedirect(redirect);
    if (target) window.location.assign(target);
    else void navigate({ to: "/cuenta" });
  };

  useEffect(() => {
    if (ready && user && !sent) goToTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, sent]);

  const setModo = (m: "registro" | "login") => {
    setSent(false);
    void navigate({ to: "/auth", search: { modo: m, redirect } });
  };

  async function withGoogle() {
    setBusy(true);
    const target = safeRedirect(redirect);
    const base = `${window.location.origin}/auth`;
    const redirectTo = target ? `${base}?redirect=${encodeURIComponent(target)}` : base;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    setBusy(false);
    if (error) toast.error("No pudimos abrir Google. " + error.message);
  }

  return (
    <>
      <PageHeader
        eyebrow="Área privada"
        title={modo === "registro" ? "Crear cuenta" : "Ingresar"}
        description="Cada cuenta se valida manualmente antes de habilitar el acceso a casos, presupuestos y vehículos."
      />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 inline-flex rounded-md border bg-card p-1" role="tablist" aria-label="Modo de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "login"}
            onClick={() => setModo("login")}
            className={
              "rounded px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors " +
              (modo === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "registro"}
            onClick={() => setModo("registro")}
            className={
              "rounded px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors " +
              (modo === "registro" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Crear cuenta
          </button>
        </div>

        {sent ? (
          <div className="rounded-lg border bg-card p-6 text-center shadow-card">
            <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-3 text-2xl font-semibold uppercase">Falta confirmar tu email</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Te enviamos un enlace de confirmación. Cuando lo abras, volvé e ingresá con la misma contraseña: tu cuenta queda
              <strong> pendiente de validación</strong> hasta que Honda Logistics la revise.
            </p>
            <Button className="mt-5" variant="outline" onClick={() => setModo("login")}>
              Ir a ingresar
            </Button>
          </div>
        ) : modo === "login" ? (
          <LoginForm googleBusy={busy} onGoogle={withGoogle} onSuccess={goToTarget} />
        ) : (
          <SignupForm googleBusy={busy} models={meta.models} onGoogle={withGoogle} onSent={() => setSent(true)} />
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Honda Logistics es una empresa independiente. El uso de la marca y el emblema Honda corresponde a su titular; esta cuenta no
          implica una relación contractual con Honda Motor Co.
        </p>
      </div>
    </>
  );
}

function LoginForm({
  googleBusy,
  onSuccess,
  onGoogle,
}: {
  googleBusy: boolean;
  onSuccess: () => void;
  onGoogle: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error("Email o contraseña incorrectos.");
      return;
    }
    onSuccess();
  }

  async function recover() {
    if (!email.trim()) {
      toast.error("Escribí tu email primero y después pedí la recuperación.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?modo=login`,
    });
    setBusy(false);
    if (error) toast.error("No pudimos enviar la recuperación. " + error.message);
    else toast.success("Si el email está registrado, vas a recibir un enlace para crear una nueva contraseña.");
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6 shadow-card">
      <Field id="login-email" label="Email">
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
        />
      </Field>
      <Field id="login-password" label="Contraseña">
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />} Ingresar
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={recover} disabled={busy}>
          <KeyRound /> Olvidé mi contraseña
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onGoogle} disabled={busy || googleBusy}>
          Continuar con Google
        </Button>
      </div>
    </form>
  );
}

function SignupForm({
  googleBusy,
  models,
  onGoogle,
  onSent,
}: {
  googleBusy: boolean;
  models: { id: string; name: string; slug: string }[];
  onGoogle: () => void;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<VehicleRow[]>([emptyRow()]);

  const patch = (i: number, p: Partial<VehicleRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...p } : row)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña necesita al menos 8 caracteres.");
      return;
    }
    const vehicles = rows
      .filter((r) => r.vin.trim().length >= 6)
      .map((r) => ({
        vin: r.vin.trim().toUpperCase(),
        plate: r.plate.trim().toUpperCase(),
        model_slug: r.model === OTHER ? "" : r.model,
        model_other: r.model === OTHER ? r.other.trim() : "",
        year: r.year,
      }));
    if (vehicles.length === 0) {
      toast.error("Cargá al menos un vehículo con su número de chasis (VIN).");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), document_id: documentId.trim(), phone: phone.trim(), vehicles } },
    });
    setBusy(false);
    if (error) {
      toast.error("No pudimos crear la cuenta. " + error.message);
      return;
    }
    if (data.session) {
      onSent();
      return;
    }
    onSent();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="su-name" label="Nombre y apellido">
          <Input id="su-name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field id="su-doc" label="Documento (CI o RUT)">
          <Input id="su-doc" required inputMode="text" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="1234567-8" />
        </Field>
        <Field id="su-phone" label="Teléfono">
          <Input id="su-phone" required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="099 123 456" />
        </Field>
        <Field id="su-email" label="Email">
          <Input id="su-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="su-pass" label="Contraseña" hint="Al menos 8 caracteres.">
            <Input
              id="su-pass"
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <fieldset className="rounded-md border p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide">Tus vehículos</legend>
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id={`vin-${i}`} label={`Chasis / VIN ${rows.length > 1 ? `(${i + 1})` : ""}`}>
                  <Input
                    id={`vin-${i}`}
                    required
                    value={row.vin}
                    onChange={(e) => patch(i, { vin: e.target.value.toUpperCase() })}
                    placeholder="JHMFD17508T012345"
                    maxLength={24}
                  />
                </Field>
              </div>
              <Field id={`plate-${i}`} label="Patente">
                <Input
                  id={`plate-${i}`}
                  value={row.plate}
                  onChange={(e) => patch(i, { plate: e.target.value.toUpperCase() })}
                  placeholder="ABC·1234"
                  maxLength={12}
                />
              </Field>
              <Field id={`year-${i}`} label="Año">
                <Select value={row.year} onValueChange={(v) => patch(i, { year: v })}>
                  <SelectTrigger id={`year-${i}`}>
                    <SelectValue placeholder="Elegí el año" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`model-${i}`} label="Modelo">
                <Select value={row.model} onValueChange={(v) => patch(i, { model: v })}>
                  <SelectTrigger id={`model-${i}`}>
                    <SelectValue placeholder="Elegí el modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.slug}>
                        {m.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>Otro modelo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {row.model === OTHER && (
                <Field id={`other-${i}`} label="Indicá el modelo">
                  <Input id={`other-${i}`} value={row.other} onChange={(e) => patch(i, { other: e.target.value })} />
                </Field>
              )}
              {rows.length > 1 && (
                <div className="sm:col-span-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                    <X /> Quitar este vehículo
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        {rows.length < 5 && (
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => setRows((r) => [...r, emptyRow()])}>
            Agregar otro vehículo
          </Button>
        )}
      </fieldset>

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />} Crear cuenta
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-sm text-xs text-muted-foreground">
          Con Google solo se toman tu nombre y email: documento, teléfono y vehículos los cargás después en Mi cuenta.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onGoogle} disabled={busy || googleBusy}>
          Continuar con Google
        </Button>
      </div>
    </form>
  );
}
