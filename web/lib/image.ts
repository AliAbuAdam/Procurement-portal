// Клиентское сжатие фото перед загрузкой: ресайз через canvas.
// Оригинал жмём до 1600px (хранение в Postgres), миниатюру — до 320px (списки).

const MAIN_MAX_SIDE = 1600;
const THUMB_MAX_SIDE = 320;
const JPEG_QUALITY = 0.85;

export interface CompressedImage {
  contentType: string;
  dataBase64: string;
  thumbBase64: string;
}

// PNG оставляем PNG (прозрачность), остальное конвертируем в JPEG.
function targetType(file: File): string {
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error(`Не удалось прочитать «${file.name}» — это точно изображение?`);
  }
}

function drawScaled(
  bitmap: ImageBitmap,
  maxSide: number,
  type: string,
): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен в этом браузере");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Не удалось сжать фото"))),
      type,
      JPEG_QUALITY,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// compressImage: файл -> сжатый оригинал + миниатюра (base64 для JSON API).
export async function compressImage(file: File): Promise<CompressedImage> {
  const type = targetType(file);
  const bitmap = await loadBitmap(file);
  try {
    const [main, thumb] = await Promise.all([
      drawScaled(bitmap, MAIN_MAX_SIDE, type),
      drawScaled(bitmap, THUMB_MAX_SIDE, type),
    ]);
    return {
      contentType: type,
      dataBase64: await blobToBase64(main),
      thumbBase64: await blobToBase64(thumb),
    };
  } finally {
    bitmap.close();
  }
}
