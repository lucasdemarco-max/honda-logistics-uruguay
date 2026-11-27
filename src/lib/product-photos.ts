import productPhotoSources from "@/data/honda-product-photos.json";

/**
 * A matching part number alone does not verify that an online image is genuine Honda.
 * Only explicitly reviewed images from local assets may be shown.
 */
export const GENERIC_PRODUCT_PHOTO = "/images/products/imagen-no-disponible.svg";
const normalizeHondaCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");

const photoCandidates = new Map(
  Object.entries(productPhotoSources).map(([code, source]) => [
    normalizeHondaCode(code),
    { url: `/images/products/${code.toLowerCase()}.webp`, source },
  ]),
);

// Each photograph has a white background and shows Honda identification without other branding.
const approvedHondaCodes = new Set([
  "14400RCAA01",
  "15400RTA003",
  "17048TEK000",
  "172206MAJ01",
  "17220R5AA00",
  "80292TR8M01",
]);
const approvedPhotoUrls = new Set(
  [...approvedHondaCodes].map((code) => photoCandidates.get(code)?.url).filter((url): url is string => !!url),
);

export function getHondaProductPhoto(code: string | null) {
  const normalized = code ? normalizeHondaCode(code) : "";
  return approvedHondaCodes.has(normalized) ? photoCandidates.get(normalized) : undefined;
}

export function getReviewedCartPhoto(url: string | null | undefined) {
  return url && approvedPhotoUrls.has(url) ? url : undefined;
}
