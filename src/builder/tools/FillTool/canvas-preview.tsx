const TO_RADIANS = Math.PI / 180;

export function canvasPreview(image, canvas, crop, scale = 1, rotate = 0) {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();

  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.rotate(rotate * TO_RADIANS);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );

  ctx.restore();
}
export function toBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
}
export async function generateCroppedImageUrl(
  image,
  crop,
  scale = 1,
  rotate = 0
) {
  const canvas = document.createElement("canvas");
  canvasPreview(image, canvas, crop, scale, rotate);

  const blob = await toBlob(canvas);

  if (!blob) {
    console.error("Failed to create blob");
    return null;
  }

  return URL.createObjectURL(blob);
}
