import productPhotoSources from "@/data/honda-product-photos.json";

export const GENERIC_PRODUCT_PHOTO = "/images/categories/otros.jpg";

const normalizeHondaCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");
const productPhotos = new Map(
  Object.entries(productPhotoSources).map(([code, source]) => [
    normalizeHondaCode(code),
    { url: `/images/products/${code.toLowerCase()}.webp`, source },
  ]),
);
const reviewedPhotoUrls = new Set(Array.from(productPhotos.values(), (photo) => photo.url));

export function getHondaProductPhoto(code: string | null) {
  return code ? productPhotos.get(normalizeHondaCode(code)) : undefined;
}

export function getReviewedCartPhoto(url: string | null | undefined) {
  return url && reviewedPhotoUrls.has(url) ? url : undefined;
}
