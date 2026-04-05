"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";

type ReceiptUploaderProps = {
  /** Optional; used to namespace the blob path. */
  clientId?: string;
  /** Optional; used to namespace the blob path when editing an existing ExpenseEntry. */
  expenseEntryId?: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
  /**
   * Optional. If set, hints to mobile browsers that this file input should use the camera.
   *
   * - true → `capture="environment"`
   * - "user" | "environment" → passed through
   */
  capture?: boolean | "user" | "environment";
  /**
   * Visual style.
   * - "card" (default): bordered card with title + helper text.
   * - "inline": minimal UI (good for embedding inside other cards/forms).
   */
  variant?: "card" | "inline";
};

export function ReceiptUploader({
  clientId,
  expenseEntryId,
  initialUrl,
  onUploaded,
  capture,
  variant = "card",
}: ReceiptUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const prefix = useMemo(() => {
    const c = (clientId ?? "unassigned").trim() || "unassigned";
    const e = (expenseEntryId ?? "draft").trim() || "draft";
    return `expense-receipts/${c}/${e}`;
  }, [clientId, expenseEntryId]);

  async function onPickFile(file: File) {
    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const pathname = `${prefix}/${Date.now()}-${safeName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/ops/v2/expenses/receipt-upload",
        clientPayload: JSON.stringify({
          clientId: clientId ?? null,
          expenseEntryId: expenseEntryId ?? null,
        }),
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (!e.total) return;
          setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      setUrl(blob.url);
      onUploaded?.(blob.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  }

  const wrapperClass = variant === "inline" ? "" : "rounded-lg border border-zinc-200 bg-white p-4";
  const captureValue = capture === true ? "environment" : capture;

  // If we can, use a real camera capture flow (more reliable than <input capture> across mobile browsers).
  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;

    async function start() {
      try {
        const facingMode = captureValue === "user" ? "user" : "environment";
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setCameraOpen(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, captureValue]);

  // On mobile, including non-image MIME types in `accept` can cause the camera capture flow
  // to fall back to the generic file picker (making "Take photo" behave like "Upload").
  const ACCEPT_CAMERA = "image/*";
  const ACCEPT_UPLOAD = "image/jpeg,image/png,image/webp,application/pdf";

  async function captureFromVideo() {
    const v = videoRef.current;
    if (!v) return;

    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(v, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;

    const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });

    setCameraOpen(false);
    await onPickFile(file);
  }

  const Trigger = (props: {
    label: string;
    capture?: boolean | "user" | "environment";
    accept: string;
    testId: string;
    inputTestId?: string;
  }) => (
    <label
      data-testid={props.testId}
      className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
    >
      <input
        data-testid={props.inputTestId}
        type="file"
        className="hidden"
        accept={props.accept}
        capture={props.capture}
        disabled={isUploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void onPickFile(f);
          e.currentTarget.value = "";
        }}
      />
      {isUploading ? "Uploading…" : props.label}
    </label>
  );

  return (
    <div className={wrapperClass}>
      <div className="flex items-start justify-between gap-4">
        {variant === "inline" ? null : (
          <div>
            <div className="text-sm font-semibold text-zinc-900">Receipt</div>
            <div className="text-xs text-zinc-500">Upload a JPG/PNG/WebP or PDF (max 15MB).</div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {captureValue ? (
            <button
              type="button"
              data-testid="receipt-upload-trigger-camera"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              disabled={isUploading}
              onClick={() => {
                setError(null);
                setCameraOpen(true);
              }}
            >
              {isUploading ? "Uploading…" : url ? "Retake photo" : "Take photo"}
            </button>
          ) : null}

          <Trigger
            testId="receipt-upload-trigger"
            inputTestId="receipt-file-input"
            label={url ? (captureValue ? "Upload file" : "Replace") : captureValue ? "Upload file" : "Upload"}
            accept={ACCEPT_UPLOAD}
          />
        </div>
      </div>

      {cameraOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4">
            <div className="text-sm font-semibold text-zinc-900">Take photo</div>
            <div className="mt-3 overflow-hidden rounded-md bg-black">
              <video ref={videoRef} className="h-auto w-full" playsInline />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setCameraOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={isUploading}
                onClick={() => {
                  void captureFromVideo();
                }}
              >
                Use photo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUploading && progress !== null ? <div className="mt-3 text-xs text-zinc-600">Uploading: {progress}%</div> : null}

      {error ? (
        <div data-testid="receipt-upload-error" className="mt-3 text-xs text-red-600">
          {error}
        </div>
      ) : null}

      {url ? (
        <div className={variant === "inline" ? "mt-2" : "mt-3"}>
          <a
            data-testid="receipt-upload-view"
            className="text-sm text-blue-700 hover:underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            View uploaded receipt
          </a>
          <div className="mt-1 break-all text-xs text-zinc-500">{url}</div>
        </div>
      ) : variant === "inline" ? (
        <div className="mt-2 text-xs text-zinc-500">No receipt yet.</div>
      ) : (
        <div className="mt-3 text-xs text-zinc-500">No receipt uploaded yet.</div>
      )}
    </div>
  );
}
