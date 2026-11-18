const uyu = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUYU(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Precio a confirmar";
  return uyu.format(value);
}

const dateFmt = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-UY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** Masks a VIN keeping only the last 4 characters visible. Never show full VINs in shared/public contexts. */
export function maskVin(vin: string | null | undefined): string {
  if (!vin) return "—";
  const clean = vin.replace(/\s/g, "").toUpperCase();
  if (clean.length <= 4) return "•".repeat(clean.length);
  return "•".repeat(clean.length - 4) + clean.slice(-4);
}

/** VIN/chasis: 11–17 alphanumeric chars, excluding I, O and Q. */
export function normalizeVin(vin: string): string {
  return vin.replace(/\s/g, "").toUpperCase();
}
export function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(normalizeVin(vin));
}

export const URUGUAY_DEPARTMENTS = [
  "Artigas",
  "Canelones",
  "Cerro Largo",
  "Colonia",
  "Durazno",
  "Flores",
  "Florida",
  "Lavalleja",
  "Maldonado",
  "Montevideo",
  "Paysandú",
  "Río Negro",
  "Rivera",
  "Rocha",
  "Salto",
  "San José",
  "Soriano",
  "Tacuarembó",
  "Treinta y Tres",
] as const;
