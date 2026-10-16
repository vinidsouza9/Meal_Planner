export type PhotoCrop = { x: number; y: number; zoom: number; rotation: number };
export type PixelCrop = { x: number; y: number; width: number; height: number };
export const PHOTO_SIZES = { recipe: { width: 1200, height: 900, aspect: 4 / 3 }, avatar: { width: 400, height: 400, aspect: 1 } } as const;

export async function readablePhoto(file: Blob): Promise<Blob> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const signature = String.fromCharCode(...header);
  if (/heic|heif|heix|hevc|mif1/i.test(signature) || /heic|heif/i.test(file.type)) {
    const { heicTo } = await import('heic-to');
    return heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
  }
  return file;
}

export async function cropPhoto(src: string, pixels: PixelCrop, rotation: number, kind: keyof typeof PHOTO_SIZES): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Couldn't open the photo.")); image.src = src; });
  const radians = rotation * Math.PI / 180;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(Math.abs(Math.cos(radians) * image.naturalWidth) + Math.abs(Math.sin(radians) * image.naturalHeight));
  canvas.height = Math.round(Math.abs(Math.sin(radians) * image.naturalWidth) + Math.abs(Math.cos(radians) * image.naturalHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Photo editing is unavailable.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  const result = document.createElement('canvas');
  result.width = PHOTO_SIZES[kind].width;
  result.height = PHOTO_SIZES[kind].height;
  const output = result.getContext('2d');
  if (!output) throw new Error('Photo editing is unavailable.');
  output.drawImage(canvas, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, result.width, result.height);
  return new Promise((resolve, reject) => result.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Couldn't save the crop.")), 'image/jpeg', 0.9));
}