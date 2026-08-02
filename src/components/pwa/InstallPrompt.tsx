import { useState } from "react";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";
import fundscopeLogo from "@/assets/fundscope-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function InstallButton({ className }: { className?: string }) {
  const pwa = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (!pwa.ready || pwa.standalone || pwa.installed) return null;
  if (!pwa.canInstall && !pwa.needsManualSteps) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={className}
        onClick={() => (pwa.canInstall ? void pwa.install() : setOpen(true))}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install</span>
      </Button>
      <IosInstructions open={open} onOpenChange={setOpen} />
    </>
  );
}

export function InstallPrompt() {
  const pwa = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (!pwa.showBanner) return <IosInstructions open={open} onOpenChange={setOpen} />;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:w-[380px]">
        <div className="glass card-glow rounded-2xl p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <img
              src={fundscopeLogo.url}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">Install FundScope</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add it to your home screen for a full-screen app experience with instant launch.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
                  onClick={() => (pwa.canInstall ? void pwa.install() : setOpen(true))}
                >
                  {pwa.canInstall ? <Download className="h-3.5 w-3.5" /> : <Share className="h-3.5 w-3.5" />}
                  {pwa.canInstall ? "Install app" : "How to install"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={pwa.dismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <button
              aria-label="Dismiss install prompt"
              onClick={pwa.dismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <IosInstructions open={open} onOpenChange={setOpen} />
    </>
  );
}

function IosInstructions({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" /> Add FundScope to your Home Screen
          </DialogTitle>
          <DialogDescription>
            iOS installs apps from the Safari Share menu — it takes two taps.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            Open this page in <strong>Safari</strong> (Chrome on iOS can't install apps).
          </Step>
          <Step n={2}>
            Tap the <Share className="inline h-4 w-4 -mt-0.5 text-primary" /> <strong>Share</strong> button in
            the browser toolbar.
          </Step>
          <Step n={3}>
            Scroll and choose <Plus className="inline h-4 w-4 -mt-0.5 text-primary" />{" "}
            <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
          </Step>
        </ol>
        <p className="text-xs text-muted-foreground">
          FundScope then launches full-screen with its own icon and splash screen.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="text-muted-foreground [&_strong]:text-foreground [&_strong]:font-medium">{children}</span>
    </li>
  );
}
