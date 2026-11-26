import productPhotoSources from "@/data/honda-product-photos.json";

export const GENERIC_PRODUCT_PHOTO = "/images/products/imagen-no-disponible.svg";

const normalizeHondaCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");
// Sources are candidates until the original Honda-branded packaging is visually verified.\nconst productPhotos = new Map(
  Object.entries(productPhotoSources).map(([code, source]) => [
    normalizeHondaCode(code),
    { url: `/images/products/${code.toLowerCase()}.webp`, source },
  ]),
);
// Populate only after verifying that the exact part code and original Honda logo appear in the photo.\nconst approvedHondaCodes = new Set<string>();\nconst reviewedPhotoUrls = new Set(Array.from(approvedHondaCodes, (code) => productPhotos.get(code)?.url).filter((url): url is string => Boolean(url)));

export function getHondaProductPhoto(code: string | null) {
  // A product code match alone does not prove the image shows original Honda branding.\n  // Do not show photos from candidate sources until they are explicitly approved.\n  const key = code ? normalizeHondaCode(code) : "";\n  return approvedHondaCodes.has(key) ? productPhotos.get(key) : undefined;
}

export function getReviewedCartPhoto(url: string | null | undefined) {
  return url && reviewedPhotoUrls.has(url) ? url : undefined;
}
