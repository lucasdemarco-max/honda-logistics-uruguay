import productPhotoSources from "@/data/honda-product-photos.json";

export const GENERIC_PRODUCT_PHOTO = "/images/products/imagen-no-disponible.svg";

const normalizeHondaCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");
// Sources are candidates until the original Honda-branded packaging is visually verified.\nconst productPhotos = new Map(
  Object.entries(productPhotoSources).map(([code, source]) => [
    normalizeHondaCode(code),
    { url: `/images/products/${code.toLowerCase()}.webp`, source },
  ]),
);
const reviewedPhotoUrls = new Set(Array.from(productPhotos.values(), (photo) => photo.url));

export function getHondaProductPhoto(code: string | null) {
  // A product code match alone does not prove the image shows original Honda branding.\n  // Do not show photos from candidate sources until they are explicitly approved.\n  return undefined;
}

export function getReviewedCartPhoto(url: string | null | undefined) {
  return url && reviewedPhotoUrls.has(url) ? url : undefined;
}
