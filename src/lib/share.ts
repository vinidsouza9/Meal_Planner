/** Share a file via the native share sheet when supported. Returns "shared" or "menu" (caller shows fallbacks). */
export async function shareFile(file: File, title: string): Promise<"shared" | "menu"> {
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  return "menu";
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download the PDF, then open WhatsApp Web so the user can attach it. */
export function shareViaWhatsApp(file: File, message: string) {
  downloadFile(file);
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

/** Download the PDF, then open the mail app with a note to attach it. */
export function shareViaEmail(file: File, subject: string, body: string) {
  downloadFile(file);
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
