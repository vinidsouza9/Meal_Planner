/** Resize an image file in the browser to at most `maxW` px wide, returned as base64 JPEG (no data: prefix). */
export async function resizeImage(file: File | Blob, maxW = 1600): Promise<{ mediaType: "image/jpeg"; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image resizing is unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const data = dataUrl.split(",")[1];
    if (!data) throw new Error("Image resizing failed.");
    return { mediaType: "image/jpeg", data, preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize an image file to at most `maxW` px wide, returned as a JPEG Blob plus a preview data URL. */
export async function resizeImageBlob(file: File | Blob, maxW = 1200): Promise<{ blob: Blob; preview: string }> {
  const { data, preview } = await resizeImage(file as File, maxW);
  return { blob: base64ToBlob(data), preview };
}

/** Base64 JPEG (no data: prefix) → Blob. */
export function base64ToBlob(data: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}
