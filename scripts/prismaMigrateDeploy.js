/*
  Vercel preview builds can run concurrently against the same Postgres database.
  Prisma uses a Postgres advisory lock during `migrate deploy`. When another
  deployment is migrating, Prisma may time out after 10s acquiring the lock.

  This wrapper retries on the known advisory-lock timeout error so builds can
  self-heal without manual redeploy spam.
*/

const { spawnSync } = require("child_process");

const enabled = process.env.PRISMA_MIGRATE_DEPLOY === "true";

if (!enabled) {
  console.log("Skipping prisma migrate deploy (set PRISMA_MIGRATE_DEPLOY=true to enable)");
  process.exit(0);
}

const MAX_ATTEMPTS = Number(process.env.PRISMA_MIGRATE_DEPLOY_RETRIES ?? "12");
const SLEEP_MS = Number(process.env.PRISMA_MIGRATE_DEPLOY_RETRY_DELAY_MS ?? "10000");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAdvisoryLockTimeout(text) {
  const msg = String(text || "");
  return msg.includes("Timed out trying to acquire a postgres advisory lock") || msg.includes("pg_advisory_lock");
}

function runMigrateDeploy() {
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  const out = `${res.stdout || ""}${res.stderr || ""}`;

  // Preserve Prisma output in Vercel logs.
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);

  return { code: res.status ?? 1, output: out };
}

(async () => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, output } = runMigrateDeploy();

    if (code === 0) process.exit(0);

    if (isAdvisoryLockTimeout(output) && attempt < MAX_ATTEMPTS) {
      console.log(
        `Prisma migrate advisory lock is busy; retrying in ${Math.round(SLEEP_MS / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS})...`
      );
      await sleep(SLEEP_MS);
      continue;
    }

    // Non-retryable error or final attempt: exit with failure.
    process.exit(code || 1);
  }
})();
