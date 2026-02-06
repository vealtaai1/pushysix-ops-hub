import * as React from "react";

export function DbUnavailableCallout({
  title = "Database unavailable",
  message,
}: {
  title?: string;
  message?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <div className="font-semibold">{title}</div>
      <div className="mt-1">
        {message ?? <>This page can’t load right now because the database connection is down or Prisma can’t connect.</>}
      </div>
      <div className="mt-2">
        <a className="underline" href="/api/health/db" target="_blank" rel="noreferrer">
          Check DB health → /api/health/db
        </a>
      </div>
    </div>
  );
}
