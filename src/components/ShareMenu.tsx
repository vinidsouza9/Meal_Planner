import { useState } from "react";
import { Download, Mail, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CookingLoader, useSlowAction } from "@/components/Loading";
import { downloadFile, shareFile, shareViaEmail, shareViaWhatsApp } from "@/lib/share";

type Props = {
  /** Build the PDF to share. Called on every interaction so the file is fresh. */
  build: () => File;
  title: string;
  /** Short message for WhatsApp, e.g. "Here's our meal plan for Oct 19 – 25." */
  message: string;
  emailSubject: string;
  disabled?: boolean;
};

/** Let the loader paint before the (synchronous) PDF build blocks the main thread. */
const nextFrame = () => new Promise<void>((r) => setTimeout(r, 60));

/** Share button: native share sheet with the PDF when supported, otherwise a download/WhatsApp/email menu. */
export function ShareMenu({ build, title, message, emailSubject, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const pdf = useSlowAction("Creating the file took too long. Please try again.");

  async function withFile(use: (f: File) => unknown | Promise<unknown>) {
    await pdf.run(async () => {
      await nextFrame();
      const file = build();
      await use(file);
    });
  }

  async function onShare() {
    await withFile(async (file) => {
      if ((await shareFile(file, title)) === "menu") setOpen(true);
    });
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" onClick={onShare} disabled={disabled || pdf.active} aria-label={`Share ${title}`}>
            <Share2 /> Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => withFile(downloadFile)}>
            <Download /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => withFile((f) => shareViaWhatsApp(f, message))}>
            <MessageCircle /> Share on WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => withFile((f) => shareViaEmail(f, emailSubject, `${message}\n\n(Attach the PDF that was just downloaded.)`))}>
            <Mail /> Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pdf.active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
          <CookingLoader task="pdf" error={pdf.error} onRetry={pdf.retry} onCancel={pdf.reset} className="w-full max-w-sm" />
        </div>
      )}
    </>
  );
}
