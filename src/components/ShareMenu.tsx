import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadFile, shareFile } from "@/lib/share";

type Props = {
  build: () => File;
  cacheKey: unknown[];
  title: string;
  disabled?: boolean;
};

/** Prepare on data changes; native sharing starts synchronously from a fresh click. */
export function ShareMenu({ build, cacheKey, title, disabled }: Props) {
  const signature = JSON.stringify(cacheKey);
  const builder = useRef(build);
  builder.current = build;
  const [ready, setReady] = useState<{ signature: string; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (disabled) return;
    setError(null);
    const timer = window.setTimeout(() => {
      try { setReady({ signature, file: builder.current() }); }
      catch { setError("We couldn't prepare your PDF. Please try again."); }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [signature, disabled]);

  const file = ready?.signature === signature ? ready.file : null;
  const preparing = !disabled && !file && !error;

  function onShare(event: React.MouseEvent) {
    event.preventDefault();
    if (!file) { if (error) setOpen(true); return; }
    // No await before shareFile: navigator.share is invoked during this user click.
    setSharing(true);
    void shareFile(file, title).then((result) => { if (result === "menu") setOpen(true); })
      .catch(() => { setError("We couldn't open the share sheet. Please try again."); setOpen(true); })
      .finally(() => setSharing(false));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" onClick={onShare} disabled={disabled || preparing || sharing} aria-label={`Share ${title}`} aria-busy={preparing || sharing}>
          {preparing ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Share2 />}
          <span aria-live="polite">{preparing ? "Preparing PDF..." : "Share"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 space-y-3 p-4">
        <p role="status" className="text-sm text-muted-foreground">{error ?? "Your browser can't attach files directly. Download the PDF and attach it in WhatsApp or your email."}</p>
        {file && <Button variant="outline" className="w-full" onClick={() => { downloadFile(file); setOpen(false); }}><Download /> Download PDF</Button>}
        {error && !file && <Button onClick={() => {
          try { setReady({ signature, file: builder.current() }); setError(null); setOpen(false); }
          catch { setError("We couldn't prepare your PDF. Please try again."); }
        }}>Try again</Button>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}