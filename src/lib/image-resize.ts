/** Resize an image file in the browser to at most `maxW` px wide, returned as base64 JPEG (no data: prefix). */
export async function resizeImage(file: File, maxW = 1600): Promise<{ mediaType: "image/jpeg"; data: string; preview: string }> {
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
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { mediaType: "image/jpeg", data: dataUrl.split(",")[1]!, preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
