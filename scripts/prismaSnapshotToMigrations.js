#!/usr/bin/env node
/*
  prismaSnapshotToMigrations.js

  Generate a migration folder from a Prisma schema "snapshot" by asking Prisma to
  diff from an empty database to the given schema.

  Usage:
    node scripts/prismaSnapshotToMigrations.js --name init_from_snapshot \
      --schema prisma/schema.prisma

  Notes:
  - This writes a new folder under prisma/migrations/ with a migration.sql.
  - It does NOT apply the migration; use `npx prisma migrate deploy` afterwards.
*/

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

function parseArgs(argv) {
  const args = { name: null, schema: "prisma/schema.prisma" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name" || a === "-n") args.name = argv[++i];
    else if (a === "--schema" || a === "-s") args.schema = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function usage(exitCode = 0) {
  const msg = `\nUsage:\n  node scripts/prismaSnapshotToMigrations.js --name <migration_name> [--schema prisma/schema.prisma]\n\nExample:\n  node scripts/prismaSnapshotToMigrations.js --name baseline_from_snapshot --schema prisma/schema.baseline.prisma\n`;
  console.log(msg);
  process.exit(exitCode);
}

function prismaTimestampUTC() {
  // Prisma creates migration folders in UTC like YYYYMMDDHHMMSS
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) usage(0);
  if (!args.name) {
    console.error("Missing required --name");
    usage(1);
  }

  const repoRoot = path.resolve(__dirname, "..");
  const schemaPath = path.resolve(repoRoot, args.schema);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${args.schema}`);
  }

  const migrationsDir = path.resolve(repoRoot, "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing prisma migrations dir: ${path.relative(repoRoot, migrationsDir)}`);
  }

  const ts = prismaTimestampUTC();
  const safeName = args.name.replace(/[^a-zA-Z0-9_\-]+/g, "_");
  const outDir = path.join(migrationsDir, `${ts}_${safeName}`);
  const outSql = path.join(outDir, "migration.sql");

  if (fs.existsSync(outDir)) {
    throw new Error(`Migration folder already exists: ${path.relative(repoRoot, outDir)}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  try {
    // Generate SQL that would take an empty DB to this schema.
    // --script prints SQL to stdout.
    const cmd = [
      "npx prisma migrate diff",
      "--from-empty",
      `--to-schema-datamodel ${JSON.stringify(args.schema)}`,
      "--script",
    ].join(" ");

    const sql = execSync(cmd, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    });

    const trimmed = sql.trim();
    if (!trimmed) {
      throw new Error("Prisma returned empty SQL; refusing to write an empty migration.");
    }

    fs.writeFileSync(outSql, trimmed + "\n", "utf8");

    console.log(`Created migration: ${path.relative(repoRoot, outDir)}`);
    console.log(`Wrote: ${path.relative(repoRoot, outSql)}`);
  } catch (err) {
    // Cleanup folder on failure so reruns are easy.
    try {
      if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    } catch (_) {
      // ignore cleanup errors
    }
    throw err;
  }
}

main();
