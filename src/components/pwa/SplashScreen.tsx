import { useEffect, useState } from "react";
import fundscopeLogo from "@/assets/fundscope-logo.png.asset.json";

/**
 * Branded launch screen shown only when the app is opened from the home screen
 * (standalone display-mode). Bridges the gap between the OS splash image and
 * the first painted dashboard so the launch feels native.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    if (sessionStorage.getItem("fundscope.splash.shown")) return;
    sessionStorage.setItem("fundscope.splash.shown", "1");
    setVisible(true);
    const fadeAt = window.setTimeout(() => setFading(true), 750);
    const hideAt = window.setTimeout(() => setVisible(false), 1200);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(hideAt);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[110px]" />
        <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-brand-2/20 blur-[110px]" />
      </div>
      <div className="relative flex flex-col items-center gap-4">
        <img
          src={fundscopeLogo.url}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 animate-in fade-in zoom-in-95 object-contain duration-500"
        />
        <div className="text-center">
          <div className="font-display text-2xl font-semibold tracking-tight">FundScope</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Mutual Fund Research Terminal
          </div>
        </div>
        <div className="mt-2 h-0.5 w-24 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] gradient-brand" />
        </div>
      </div>
    </div>
  );
}
