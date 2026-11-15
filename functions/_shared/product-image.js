export function cleanProductImage(value) {
  const image = String(value ?? '').trim();
  if (!image) return '';
  if (image.length <= 2048 && /^https:\/\//i.test(image)) return image;
  if (image.length <= 900_000 && /^data:image\/webp;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)) return image;
  return null;
}
