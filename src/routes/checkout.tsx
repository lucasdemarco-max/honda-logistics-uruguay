import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, Landmark, LogIn, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatUYU, URUGUAY_DEPARTMENTS } from "@/lib/format";
import { BUSINESS } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar solicitud — Honda Logistics" },
      { name: "description", content: "Confirmá tu solicitud de pedido. Pago por transferencia bancaria; envíos dentro de Uruguay o retiro a coordinar." },
      { property: "og:title", content: "Finalizar solicitud — Honda Logistics" },
      { property: "og:description", content: "Pago por transferencia bancaria y envíos en Uruguay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, totals, clear, hydrated } = useCart();
  const { user, ready } = useAuth();
  const [delivery, setDelivery] = useState<"envio_uruguay" | "retiro_coordinar">("envio_uruguay");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (done)
    return (
      <>
        <PageHeader eyebrow="Compra" title="Solicitud enviada" />
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
          <h2 className="mt-4 text-3xl font-bold uppercase">Recibimos tu solicitud {done}</h2>
          <p className="mt-3 text-muted-foreground">
            Honda Logistics va a revisar disponibilidad y precios finales y se va a comunicar con vos para confirmar el pedido, el envío y
            los datos para la transferencia. Todavía no se realizó ningún cobro.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild><Link to="/cuenta">Ver mis pedidos</Link></Button>
            <Button asChild variant="outline"><Link to="/catalogo">Seguir comprando</Link></Button>
          </div>
        </div>
      </>
    );

  if (hydrated && items.length === 0)
    return (
      <>
        <PageHeader eyebrow="Compra" title="Finalizar solicitud" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState icon={ShoppingCart} title="No hay artículos para confirmar" action={<Button asChild><Link to="/catalogo">Ir al catálogo</Link></Button>} />
        </div>
      </>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (delivery === "envio_uruguay" && (!department || !city.trim() || !address.trim())) {
      toast.error("Completá departamento, ciudad y dirección para el envío.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("order_requests")
      .insert({
        user_id: user.id,
        items: items.map((i) => ({ product_id: i.productId, sku: i.sku, name: i.name, quantity: i.quantity, unit_price_uyu: i.priceUYU })),
        total_uyu: totals.total,
        delivery_method: delivery,
        department: delivery === "envio_uruguay" ? department : null,
        city: delivery === "envio_uruguay" ? city.trim() : null,
        address: delivery === "envio_uruguay" ? address.trim() : null,
        contact_phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .select("order_number")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("No pudimos enviar la solicitud. Probá de nuevo.");
      return;
    }
    clear();
    setDone(data.order_number);
  };

  return (
    <>
      <PageHeader eyebrow="Compra" title="Finalizar solicitud" description="Este paso registra tu solicitud de pedido. No se realiza ningún cobro online." />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <form onSubmit={submit} className="space-y-8">
          <section className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-2xl font-semibold uppercase">1. Entrega</h2>
            <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as typeof delivery)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Label htmlFor="d-envio" className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[[data-state=checked]]:border-primary">
                <RadioGroupItem id="d-envio" value="envio_uruguay" className="mt-0.5" />
                <span><span className="block font-semibold">Envío dentro de Uruguay</span><span className="text-xs font-normal text-muted-foreground">Modalidad y costo a coordinar.</span></span>
              </Label>
              <Label htmlFor="d-retiro" className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[[data-state=checked]]:border-primary">
                <RadioGroupItem id="d-retiro" value="retiro_coordinar" className="mt-0.5" />
                <span><span className="block font-semibold">Retiro a coordinar</span><span className="text-xs font-normal text-muted-foreground">Te contactamos para acordar lugar y horario.</span></span>
              </Label>
            </RadioGroup>
            {delivery === "envio_uruguay" && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dep">Departamento</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger id="dep" className="mt-1"><SelectValue placeholder="Elegí un departamento" /></SelectTrigger>
                    <SelectContent>{URUGUAY_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="city">Ciudad / localidad</Label>
                  <Input id="city" className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="addr">Dirección</Label>
                  <Input id="addr" className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={160} />
                </div>
              </div>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Teléfono de contacto</Label>
                <Input id="phone" type="tel" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Observaciones</Label>
                <Textarea id="notes" className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Ej.: número de chasis para verificar compatibilidad" />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-2xl font-semibold uppercase">2. Pago</h2>
            <div className="mt-4 flex items-start gap-3 rounded-md border border-primary bg-accent/40 p-4">
              <Landmark className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="font-semibold">Transferencia bancaria (único medio de pago online)</p>
                {BUSINESS.bankTransfer ? (
                  <p className="mt-1 text-sm">{BUSINESS.bankTransfer.bank} · {BUSINESS.bankTransfer.accountHolder} · {BUSINESS.bankTransfer.accountNumber} ({BUSINESS.bankTransfer.currency})</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Te enviaremos los datos bancarios al confirmar disponibilidad y precio final.</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-md border p-4 text-sm text-muted-foreground">
              <CreditCard className="mt-0.5 h-5 w-5" aria-hidden />
              <p>Tarjetas de crédito y débito: solo en el local físico. No se aceptan pagos con tarjeta online.</p>
            </div>
          </section>

          {!ready ? null : user ? (
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar solicitud de pedido"}
            </Button>
          ) : (
            <div className="rounded-lg border bg-card p-6 shadow-card">
              <p className="font-semibold">Ingresá a tu cuenta para enviar la solicitud.</p>
              <p className="mt-1 text-sm text-muted-foreground">Tu carrito se mantiene guardado en este dispositivo.</p>
              <div className="mt-4 flex gap-3">
                <Button asChild><Link to="/auth" search={{ redirect: "/checkout" }}><LogIn /> Ingresar</Link></Button>
                <Button asChild variant="outline"><Link to="/auth" search={{ modo: "registro", redirect: "/checkout" }}>Crear cuenta</Link></Button>
              </div>
            </div>
          )}
        </form>

        <aside className="h-fit rounded-lg border bg-card p-6 shadow-card lg:sticky lg:top-24">
          <h2 className="text-2xl font-semibold uppercase">Tu pedido</h2>
          <ul className="mt-4 divide-y text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 py-2">
                <span>{i.quantity} × {i.name}</span>
                <span className="whitespace-nowrap">{i.priceUYU === null ? "A confirmar" : formatUYU(i.priceUYU * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t pt-3 font-semibold"><span>Total estimado</span><span>{formatUYU(totals.total)}</span></div>
          <p className="mt-2 text-xs text-muted-foreground">Envío no incluido. Precio final sujeto a confirmación.</p>
        </aside>
      </div>
    </>
  );
}
