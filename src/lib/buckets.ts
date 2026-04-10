export type Bucket = { key: string; name: string };

// IMPORTANT:
// - bucketKey is the canonical/stable identifier stored in WorklogEntry
// - bucketName is derived server-side from bucketKey (clients must not be able to spoof it)
export const BUCKETS: Bucket[] = [
  { key: "capture", name: "Filming / Photography Capture" },
  { key: "travel", name: "Traveling" },
  { key: "editing", name: "Editing" },
  { key: "management", name: "Management" },
  { key: "administration", name: "Administration" },
  { key: "smm", name: "Social Media Management" },
  { key: "photo_video_editing", name: "Photo/Video Editing" },
  { key: "web_design", name: "Web Design" },
  { key: "strategy_deployment", name: "Marketing Strategy Deployment" },
  { key: "consulting", name: "Consulting" },
  { key: "graphic_design", name: "Graphic Design" },
  { key: "misc", name: "Miscellaneous" },
];

export const BUCKET_KEY_TO_NAME: ReadonlyMap<string, string> = new Map(BUCKETS.map((b) => [b.key, b.name] as const));

export function bucketNameForKey(bucketKey: string): string | null {
  const key = String(bucketKey ?? "").trim();
  if (!key) return null;
  return BUCKET_KEY_TO_NAME.get(key) ?? null;
}

export function assertValidBucketKey(bucketKey: string): { bucketKey: string; bucketName: string } {
  const key = String(bucketKey ?? "").trim();
  const name = bucketNameForKey(key);
  if (!name) {
    // keep the error message stable for API callers
    throw new Error(`Invalid bucketKey: ${key || "(empty)"}`);
  }
  return { bucketKey: key, bucketName: name };
}
