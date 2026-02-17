/*
  Vercel preview builds can run concurrently against the same Postgres database.
  Prisma uses a Postgres advisory lock during `migrate deploy`. When another
  deployment is migrating, Prisma may time out after 10s acquiring the lock.

  This wrapper retries on the known advisory-lock timeout error so builds can
  self-heal without manual redeploy spam.
*/

const { execSync } = require("child_process");

const enabled = process.env.PRISMA_MIGRATE_DEPLOY === "true";

if (!enabled) {
  console.log("Skipping prisma migrate deploy (set PRISMA_MIGRATE_DEPLOY=true to enable)");
  process.exit(0);
}

const MAX_ATTEMPTS = Number(process.env.PRISMA_MIGRATE_DEPLOY_RETRIES ?? "5");
const SLEEP_MS = Number(process.env.PRISMA_MIGRATE_DEPLOY_RETRY_DELAY_MS ?? "5000");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAdvisoryLockTimeout(err) {
  const msg = (err && (err.message || String(err))) || "";
  return msg.includes("Timed out trying to acquire a postgres advisory lock") || msg.includes("pg_advisory_lock");
}

(async () => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      process.exit(0);
    } catch (err) {
      if (isAdvisoryLockTimeout(err) && attempt < MAX_ATTEMPTS) {
        console.log(
          `Prisma migrate advisory lock is busy; retrying in ${Math.round(SLEEP_MS / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS})...`
        );
        await sleep(SLEEP_MS);
        continue;
      }

      // Re-throw non-retryable errors or final attempt
      throw err;
    }
  }
})();
