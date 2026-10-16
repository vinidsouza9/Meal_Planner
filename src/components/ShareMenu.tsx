import { useState } from "react";
import { Download, Mail, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

/** Share button: native share sheet with the PDF when supported, otherwise a download/WhatsApp/email menu. */
export function ShareMenu({ build, title, message, emailSubject, disabled }: Props) {
  const [open, setOpen] = useState(false);

  async function onShare() {
    const file = build();
    if ((await shareFile(file, title)) === "menu") setOpen(true);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" onClick={onShare} disabled={disabled} aria-label={`Share ${title}`}>
          <Share2 /> Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => downloadFile(build())}>
          <Download /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareViaWhatsApp(build(), message)}>
          <MessageCircle /> Share on WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareViaEmail(build(), emailSubject, `${message}\n\n(Attach the PDF that was just downloaded.)`)}>
          <Mail /> Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
