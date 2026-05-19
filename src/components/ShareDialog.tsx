import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, Linkedin, Mail, Twitter } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CertificationInfo {
  name: string;
  organizationName: string;
  issueDate: string; // ISO
  expirationDate?: string; // ISO
  certId?: string;
}

interface ShareDialogProps {
  url: string; // path or absolute
  title: string;
  summary?: string;
  trigger: React.ReactNode;
  qrId?: string;
  certification?: CertificationInfo; // when set, LinkedIn opens "Add to profile"
}

export function ShareDialog({ url, title, summary, trigger, qrId = "share-qr", certification }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const absoluteUrl = useMemo(() => {
    if (typeof window === "undefined") return url;
    return url.startsWith("http") ? url : `${window.location.origin}${url}`;
  }, [url]);

  const linkedInUrl = useMemo(() => {
    if (certification) {
      const issued = new Date(certification.issueDate);
      const expires = certification.expirationDate ? new Date(certification.expirationDate) : null;
      const params = new URLSearchParams({
        startTask: "CERTIFICATION_NAME",
        name: certification.name,
        organizationName: certification.organizationName,
        issueYear: String(issued.getFullYear()),
        issueMonth: String(issued.getMonth() + 1),
        certUrl: absoluteUrl,
      });
      if (certification.certId) params.set("certId", certification.certId);
      if (expires) {
        params.set("expirationYear", String(expires.getFullYear()));
        params.set("expirationMonth", String(expires.getMonth() + 1));
      }
      return `https://www.linkedin.com/profile/add?${params.toString()}`;
    }
    return `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(absoluteUrl)}&title=${encodeURIComponent(title)}${summary ? `&summary=${encodeURIComponent(summary)}` : ""}&source=MicroCred`;
  }, [absoluteUrl, certification, title, summary]);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(absoluteUrl)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent((summary ? summary + "\n\n" : "") + absoluteUrl)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Copy not allowed in this preview — select the link manually.");
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById(qrId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {title}</DialogTitle>
          <DialogDescription>
            Share this verifiable link, post it to LinkedIn, or download a QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={absoluteUrl} readOnly className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={copy} aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // Belt-and-braces: if the anchor is intercepted by the dialog or
                // the iframe sandbox blocks the new tab, fall back to window.open
                // and finally to copying the link.
                if (e.defaultPrevented) return;
                setTimeout(() => {
                  // best effort — if nothing happened, popup may be blocked
                  const w = window.open(linkedInUrl, "_blank", "noopener,noreferrer");
                  if (!w) {
                    navigator.clipboard.writeText(linkedInUrl).then(() =>
                      toast.message("Popup blocked", {
                        description: "LinkedIn share link copied — paste it into a new tab.",
                      }),
                    );
                  }
                }, 0);
              }}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Linkedin className="h-4 w-4" /> {certification ? "Add to LinkedIn" : "LinkedIn"}
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Twitter className="h-4 w-4" /> X
            </a>
            <a
              href={mailUrl}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Mail className="h-4 w-4" /> Email
            </a>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <QRCodeCanvas
              id={qrId}
              value={absoluteUrl}
              size={180}
              level="M"
              includeMargin
            />
            <Button variant="ghost" size="sm" onClick={downloadQR}>
              <Download className="mr-1 h-4 w-4" /> Download QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
