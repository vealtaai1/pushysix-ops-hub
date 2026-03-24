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
};

export function ReceiptUploader({
  clientId,
  expenseEntryId,
  initialUrl,
  onUploaded,
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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Receipt</div>
          <div className="text-xs text-zinc-500">Upload a JPG/PNG/WebP or PDF (max 15MB).</div>
        </div>

        <label
          data-testid="receipt-upload-trigger"
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          <input
            data-testid="receipt-file-input"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void onPickFile(f);
              e.currentTarget.value = "";
            }}
          />
          {isUploading ? "Uploading…" : url ? "Replace" : "Upload"}
        </label>
      </div>

      {isUploading && progress !== null ? (
        <div className="mt-3 text-xs text-zinc-600">Uploading: {progress}%</div>
      ) : null}

      {error ? (
        <div data-testid="receipt-upload-error" className="mt-3 text-xs text-red-600">
          {error}
        </div>
      ) : null}

      {url ? (
        <div className="mt-3">
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
      ) : (
        <div className="mt-3 text-xs text-zinc-500">No receipt uploaded yet.</div>
      )}
    </div>
  );
}
