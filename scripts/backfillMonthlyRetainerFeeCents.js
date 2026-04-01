/*
  Backfill Client.monthlyRetainerFeeCents from an external JSON mapping.

  Safety properties:
  - Dry-run by default
  - Requires --apply AND --yes to write
  - Validates client IDs exist
  - By default only updates rows where monthlyRetainerFeeCents is currently NULL

  Usage:
    node scripts/backfillMonthlyRetainerFeeCents.js --map ./fees.json
    node scripts/backfillMonthlyRetainerFeeCents.js --map ./fees.json --apply --yes

  Mapping format (either):
    { "clientId": 2500, "clientId2": "1999.99" }
  or:
    [ { "clientId": "...", "feeDollars": 2500 }, ... ]
*/

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function printUsageAndExit(code = 1) {
  // eslint-disable-next-line no-console
  console.log(`\nBackfill monthlyRetainerFeeCents for clients\n\nUsage:\n  node scripts/backfillMonthlyRetainerFeeCents.js --map <path/to/fees.json> [--apply --yes] [--force] [--allow-overwrite] [--allow-missing]\n\nOptions:\n  --map <file>         Path to JSON file containing fee mapping\n  --apply              Perform writes (otherwise dry-run)\n  --yes                Required with --apply (safety latch)\n  --force              Update even if monthlyRetainerFeeCents is already set\n  --allow-overwrite     Allow overwriting a *different* existing value (requires --force)\n  --allow-missing       Do not error if mapping contains unknown client IDs\n\nNotes:\n  - By default the script only fills NULL monthlyRetainerFeeCents.\n  - Fees are interpreted as dollars and converted to cents.\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    mapPath: null,
    apply: false,
    yes: false,
    force: false,
    allowOverwrite: false,
    allowMissing: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--map") {
      args.mapPath = argv[++i];
    } else if (a === "--apply") {
      args.apply = true;
    } else if (a === "--yes") {
      args.yes = true;
    } else if (a === "--force") {
      args.force = true;
    } else if (a === "--allow-overwrite") {
      args.allowOverwrite = true;
    } else if (a === "--allow-missing") {
      args.allowMissing = true;
    } else if (a === "-h" || a === "--help") {
      printUsageAndExit(0);
    } else {
      // Unknown arg
      // eslint-disable-next-line no-console
      console.error(`Unknown argument: ${a}`);
      printUsageAndExit(1);
    }
  }

  return args;
}

function coerceDollarsToCents(value, ctx) {
  // Accept numbers or numeric strings. Interpret as dollars.
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`${ctx}: fee must be a finite number (dollars). Got: ${JSON.stringify(value)}`);
  }
  if (n < 0) {
    throw new Error(`${ctx}: fee cannot be negative. Got: ${n}`);
  }

  // Enforce <= 2 decimal places.
  const centsExact = n * 100;
  const rounded = Math.round(centsExact);
  const diff = Math.abs(centsExact - rounded);
  if (diff > 1e-6) {
    throw new Error(`${ctx}: fee has more than 2 decimal places. Got: ${n}`);
  }

  return rounded;
}

function normalizeMapping(json) {
  // returns array of { clientId, feeCents }
  if (Array.isArray(json)) {
    return json.map((row, idx) => {
      if (!row || typeof row !== "object") {
        throw new Error(`mapping[${idx}]: expected object, got ${typeof row}`);
      }
      const clientId = row.clientId;
      const feeDollars = row.feeDollars;
      if (typeof clientId !== "string" || clientId.length < 5) {
        throw new Error(`mapping[${idx}].clientId: expected a client ID string`);
      }
      const feeCents = coerceDollarsToCents(feeDollars, `mapping[${idx}] (${clientId})`);
      return { clientId, feeCents };
    });
  }

  if (json && typeof json === "object") {
    return Object.entries(json).map(([clientId, feeDollars]) => {
      if (typeof clientId !== "string" || clientId.length < 5) {
        throw new Error(`mapping key ${JSON.stringify(clientId)}: expected a client ID string`);
      }
      const feeCents = coerceDollarsToCents(feeDollars, `mapping (${clientId})`);
      return { clientId, feeCents };
    });
  }

  throw new Error(`mapping: expected an object map or array, got ${typeof json}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.mapPath) printUsageAndExit(1);

  if (args.allowOverwrite && !args.force) {
    // eslint-disable-next-line no-console
    console.error(`--allow-overwrite requires --force`);
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), args.mapPath);
  if (!fs.existsSync(resolved)) {
    // eslint-disable-next-line no-console
    console.error(`Mapping file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Failed to parse JSON: ${resolved}`);
    throw e;
  }

  const mappingRows = normalizeMapping(parsed);

  // detect duplicate client IDs in mapping
  const seen = new Set();
  for (const r of mappingRows) {
    if (seen.has(r.clientId)) {
      throw new Error(`Duplicate clientId in mapping: ${r.clientId}`);
    }
    seen.add(r.clientId);
  }

  const clientIds = mappingRows.map((r) => r.clientId);
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, monthlyRetainerFeeCents: true },
  });

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const unknownIds = clientIds.filter((id) => !clientById.has(id));

  if (unknownIds.length > 0 && !args.allowMissing) {
    // eslint-disable-next-line no-console
    console.error(`Unknown client IDs in mapping (not found in DB):\n${unknownIds.map((x) => `  - ${x}`).join("\n")}`);
    // eslint-disable-next-line no-console
    console.error(`Re-run with --allow-missing to ignore them (not recommended).`);
    process.exit(1);
  }

  const plan = [];
  const skipped = [];

  for (const row of mappingRows) {
    const client = clientById.get(row.clientId);
    if (!client) {
      skipped.push({
        clientId: row.clientId,
        clientName: null,
        reason: "UNKNOWN_CLIENT_ID",
        fromCents: null,
        toCents: row.feeCents,
      });
      continue;
    }

    const current = client.monthlyRetainerFeeCents;

    if (current == null) {
      plan.push({
        clientId: client.id,
        clientName: client.name,
        fromCents: null,
        toCents: row.feeCents,
        action: "SET" ,
      });
      continue;
    }

    if (!args.force) {
      skipped.push({
        clientId: client.id,
        clientName: client.name,
        reason: "ALREADY_SET (use --force to override)",
        fromCents: current,
        toCents: row.feeCents,
      });
      continue;
    }

    if (current !== row.feeCents && !args.allowOverwrite) {
      skipped.push({
        clientId: client.id,
        clientName: client.name,
        reason: "DIFFERENT_EXISTING_VALUE (add --allow-overwrite to override)",
        fromCents: current,
        toCents: row.feeCents,
      });
      continue;
    }

    plan.push({
      clientId: client.id,
      clientName: client.name,
      fromCents: current,
      toCents: row.feeCents,
      action: current === row.feeCents ? "NOOP (same value)" : "OVERWRITE",
    });
  }

  const dryRun = !(args.apply && args.yes);

  // eslint-disable-next-line no-console
  console.log(`\nBackfill monthlyRetainerFeeCents`);
  // eslint-disable-next-line no-console
  console.log(`Mapping file: ${resolved}`);
  // eslint-disable-next-line no-console
  console.log(`Mode: ${dryRun ? "DRY-RUN (no writes)" : "APPLY"}`);

  // eslint-disable-next-line no-console
  console.log(`\nPlanned updates: ${plan.length}`);
  for (const p of plan) {
    // eslint-disable-next-line no-console
    console.log(`  - ${p.clientName} (${p.clientId}): ${p.fromCents ?? "NULL"} -> ${p.toCents} cents [${p.action}]`);
  }

  if (skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`\nSkipped: ${skipped.length}`);
    for (const s of skipped) {
      // eslint-disable-next-line no-console
      console.log(`  - ${s.clientName ?? "(unknown)"} (${s.clientId}): ${s.reason} (current=${s.fromCents ?? "NULL"}, requested=${s.toCents})`);
    }
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(`\nDry-run complete. To apply: add --apply --yes`);
    return;
  }

  if (plan.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`\nNothing to update.`);
    return;
  }

  // Apply sequentially to keep logs readable and reduce transaction blast radius.
  let updated = 0;
  for (const p of plan) {
    if (p.action === "NOOP (same value)") continue;

    await prisma.client.update({
      where: { id: p.clientId },
      data: { monthlyRetainerFeeCents: p.toCents },
    });
    updated++;
    // eslint-disable-next-line no-console
    console.log(`Updated ${p.clientName} (${p.clientId}) -> ${p.toCents} cents`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nApply complete. Updated rows: ${updated}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
