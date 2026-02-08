"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// jsQR has no default TS types bundled in this repo.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsQR from "jsqr";

type Props = {
  onDetected: (value: string) => void;
};

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const w = globalThis as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"] });
  } catch {
    return new w.BarcodeDetector();
  }
}

export function CameraScan({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState<string | null>(null);

  const detector = useMemo(() => getBarcodeDetector(), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;

    async function start() {
      setError(null);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Camera unavailable: ${msg}`);
        setEnabled(false);
        return;
      }

      if (cancelled) return;

      const v = videoRef.current;
      if (!v) return;

      v.srcObject = stream;
      await v.play();

      const scan = async () => {
        if (cancelled) return;
        const v2 = videoRef.current;
        const c = canvasRef.current;
        if (!v2 || !c) {
          raf = requestAnimationFrame(scan);
          return;
        }

        const w = v2.videoWidth;
        const h = v2.videoHeight;

        if (!w || !h) {
          raf = requestAnimationFrame(scan);
          return;
        }

        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          raf = requestAnimationFrame(scan);
          return;
        }

        ctx.drawImage(v2, 0, 0, w, h);

        // 1) Try native BarcodeDetector when present.
        if (detector) {
          try {
            const results = await detector.detect(c);
            const value = results?.[0]?.rawValue?.trim();
            if (value) {
              setLastValue(value);
              onDetected(value);
              // Pause briefly to avoid multiple triggers.
              raf = window.setTimeout(() => requestAnimationFrame(scan), 800) as unknown as number;
              return;
            }
          } catch {
            // fall through to jsQR
          }
        }

        // 2) QR fallback via jsQR
        try {
          const img = ctx.getImageData(0, 0, w, h);
          const res = jsQR(img.data, img.width, img.height);
          const value = res?.data?.trim();
          if (value) {
            setLastValue(value);
            onDetected(value);
            raf = window.setTimeout(() => requestAnimationFrame(scan), 800) as unknown as number;
            return;
          }
        } catch {
          // ignore
        }

        raf = requestAnimationFrame(scan);
      };

      raf = requestAnimationFrame(scan);
    }

    void start();

    return () => {
      cancelled = true;
      if (raf) {
        // raf may be timeout id as well — both are ok to cancel via clear*.
        cancelAnimationFrame(raf);
        clearTimeout(raf);
      }
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
    };
  }, [enabled, detector, onDetected]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Camera scan (optional)</div>
          <div className="text-xs text-zinc-600">Uses BarcodeDetector when available; QR falls back to jsQR.</div>
        </div>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-medium ${enabled ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? "Stop" : "Start"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div> : null}

      {enabled ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-black">
            <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-zinc-600">Point the camera at a QR code or barcode.</div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
              <div className="font-semibold text-zinc-700">Last scan</div>
              <div className="mt-1 break-all text-zinc-900">{lastValue ?? "—"}</div>
            </div>
            <div className="text-[11px] text-zinc-500">
              Tip: you can also paste a QR URL or type the code manually.
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : null}
    </div>
  );
}
