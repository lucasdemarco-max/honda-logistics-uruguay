import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];
export type PartStatus = Enums["part_status"];
export type AccountStatus = Enums["account_status"];
export type QuoteStatus = Enums["quote_status"];
export type QuoteItemStatus = Enums["quote_item_status"];
export type TransferStatus = Enums["transfer_status"];
export type Availability = Enums["availability"];
export type BrandSegment = Enums["brand_segment"];
export type HondaRelation = Enums["honda_relation"];
export type OrderStatus = Enums["order_status"];
export type OperatorPermission = Enums["operator_permission"];
export type AppRole = Enums["app_role"];

export type Tone = "default" | "success" | "warning" | "info" | "muted" | "accent" | "destructive" | "outline";

/** Logistic states for each part in a case — labels are exact business wording. Order matters. */
export const PART_STATUSES: { value: PartStatus; label: string; tone: Tone }[] = [
  { value: "pendiente_fabrica", label: "Pendiente con Fabrica", tone: "muted" },
  { value: "en_transito", label: "En Transito de Entrega", tone: "info" },
  { value: "liberacion_aduanas", label: "Liberacion de Aduanas", tone: "warning" },
  { value: "en_recepcion", label: "En recepcion", tone: "info" },
  { value: "arribado", label: "Arribado", tone: "accent" },
  { value: "despachado", label: "Despachado", tone: "accent" },
  { value: "entregado", label: "Entregado", tone: "success" },
];

export const ACCOUNT_STATUSES: { value: AccountStatus; label: string; tone: Tone }[] = [
  { value: "pendiente_validacion", label: "Pendiente de validación", tone: "warning" },
  { value: "en_revision", label: "En revisión", tone: "info" },
  { value: "habilitada", label: "Cuenta habilitada", tone: "success" },
  { value: "rechazada", label: "Datos incorrectos / Rechazada", tone: "destructive" },
  { value: "correccion_solicitada", label: "Corrección solicitada", tone: "accent" },
];

export const QUOTE_STATUSES: { value: QuoteStatus; label: string; tone: Tone }[] = [
  { value: "pendiente_decision", label: "Pendiente de decisión", tone: "warning" },
  { value: "comprado_parcial", label: "Comprado parcialmente", tone: "info" },
  { value: "comprado", label: "Comprado", tone: "success" },
  { value: "vencido", label: "Vencido", tone: "muted" },
  { value: "anulado", label: "Anulado", tone: "destructive" },
];

export const QUOTE_ITEM_STATUSES: { value: QuoteItemStatus; label: string; tone: Tone }[] = [
  { value: "pendiente", label: "Pendiente", tone: "warning" },
  { value: "comprado", label: "Comprado", tone: "success" },
  { value: "no_comprado", label: "No comprado", tone: "muted" },
  { value: "anulado", label: "Anulado", tone: "destructive" },
];

export const TRANSFER_STATUSES: { value: TransferStatus; label: string; tone: Tone }[] = [
  { value: "pendiente_revision", label: "Pendiente de revisión", tone: "warning" },
  { value: "en_verificacion", label: "En verificación", tone: "info" },
  { value: "documentacion_solicitada", label: "Documentación adicional solicitada", tone: "accent" },
  { value: "aprobada", label: "Aprobada", tone: "success" },
  { value: "rechazada", label: "Rechazada", tone: "destructive" },
];

export const AVAILABILITY: { value: Availability; label: string; tone: Tone }[] = [
  { value: "en_stock", label: "En stock", tone: "success" },
  { value: "pocas_unidades", label: "Pocas unidades", tone: "warning" },
  { value: "a_pedido", label: "A pedido", tone: "info" },
  { value: "sin_stock", label: "Sin stock", tone: "muted" },
  { value: "consultar", label: "Consultar disponibilidad", tone: "outline" },
];

export const BRAND_SEGMENTS: { value: BrandSegment; label: string }[] = [
  { value: "neumaticos", label: "Neumáticos" },
  { value: "baterias", label: "Baterías" },
  { value: "lubricantes", label: "Lubricantes" },
  { value: "accesorios", label: "Accesorios" },
  { value: "otros", label: "Otros productos" },
];

export const HONDA_RELATIONS: { value: HondaRelation; label: string; description: string; tone: Tone }[] = [
  {
    value: "homologado_honda",
    label: "Homologado por Honda",
    description: "Cuenta con respaldo documental de homologación registrado por Honda Logistics.",
    tone: "success",
  },
  {
    value: "compatible",
    label: "Compatible",
    description: "Compatible según especificación técnica. No implica homologación de Honda.",
    tone: "info",
  },
  {
    value: "recomendado",
    label: "Recomendado",
    description: "Recomendado por Honda Logistics. No implica homologación de Honda.",
    tone: "muted",
  },
];

export const ORDER_STATUSES: { value: OrderStatus; label: string; tone: Tone }[] = [
  { value: "recibida", label: "Solicitud recibida", tone: "warning" },
  { value: "en_revision", label: "En revisión", tone: "info" },
  { value: "confirmada", label: "Confirmada", tone: "success" },
  { value: "cancelada", label: "Cancelada", tone: "muted" },
];

export const OPERATOR_PERMISSIONS: { value: OperatorPermission; label: string }[] = [
  { value: "catalogo", label: "Catálogo y marcas" },
  { value: "clientes", label: "Clientes y vehículos" },
  { value: "casos", label: "Casos y seguimiento" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "titularidad", label: "Cambios de titularidad" },
  { value: "pedidos", label: "Pedidos" },
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  operador: "Operador autorizado",
  cliente: "Cliente",
};

export function findOption<T extends string>(list: { value: T; label: string; tone?: Tone }[], value: T | null | undefined) {
  return list.find((o) => o.value === value);
}

export function partStatusIndex(status: PartStatus): number {
  return PART_STATUSES.findIndex((s) => s.value === status);
}

/** Moving a part to an earlier logistic stage is a correction and must be flagged in history. */
export function isStatusCorrection(from: PartStatus, to: PartStatus): boolean {
  return partStatusIndex(to) < partStatusIndex(from);
}

/** A product may only be shown as "Homologado por Honda" when a documental reference exists. */
export function canClaimHomologation(relation: HondaRelation | null | undefined, reference: string | null | undefined): boolean {
  if (relation !== "homologado_honda") return true;
  return !!reference && reference.trim().length > 0;
}
