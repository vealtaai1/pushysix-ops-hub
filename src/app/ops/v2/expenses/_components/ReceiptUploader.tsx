"use client";

import { upload } from "@vercel/blob/client";
import { useMemo, useState } from "react";

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

  const Trigger = (props: {
    label: string;
    capture?: boolean | "user" | "environment";
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
        accept="image/jpeg,image/png,image/webp,application/pdf"
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
            <Trigger
              testId="receipt-upload-trigger-camera"
              inputTestId="receipt-file-input-camera"
              label={url ? "Retake photo" : "Take photo"}
              capture={captureValue}
            />
          ) : null}

          <Trigger
            testId="receipt-upload-trigger"
            inputTestId="receipt-file-input"
            label={url ? (captureValue ? "Upload file" : "Replace") : captureValue ? "Upload file" : "Upload"}
          />
        </div>
      </div>

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
