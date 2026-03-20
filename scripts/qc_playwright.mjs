import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QC_BASE_URL || "https://ops.pushysix.com";
const EMAIL = process.env.QC_EMAIL;
const PASSWORD = process.env.QC_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Missing QC_EMAIL or QC_PASSWORD env vars");
  process.exit(2);
}

const outDir = path.resolve(".qc-artifacts");
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await import("playwright");

function safeName(s) {
  return s.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);
}

async function snap(page, label) {
  const file = path.join(outDir, `${safeName(label)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLines = [];
  const pageErrors = [];
  const failedResponses = [];

  page.on("console", (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err?.stack || err));
  });
  page.on("response", async (res) => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      // Avoid logging secrets in URLs (just in case)
      failedResponses.push({ status, url });
    }
  });

  // 1) Login
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="email"], input[inputmode="email"], input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click('button[type="submit"]')
  ]);

  await snap(page, "after_login");

  const targets = [
    "/dashboard",
    "/worklog",
    "/admin/approvals",
    "/admin/worklogs",
    "/admin/equipment",
    "/admin/payroll",
    "/admin/users"
  ];

  const results = [];

  for (const t of targets) {
    const url = `${BASE}${t}`;
    const r = { path: t, url, ok: true, status: null, screenshot: null };
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
      r.status = resp?.status() ?? null;
      r.screenshot = await snap(page, t);

      // Detect common Next.js error overlay text
      const bodyText = await page.textContent("body");
      if (bodyText && bodyText.includes("Application error")) r.ok = false;
      if (r.status && r.status >= 400) r.ok = false;
    } catch (e) {
      r.ok = false;
      r.status = "NAV_ERROR";
      r.screenshot = await snap(page, `error_${t}`);
      consoleLines.push(`[naverror] ${t}: ${String(e)}`);
    }
    results.push(r);
  }

  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ base: BASE, results, consoleLines, pageErrors, failedResponses }, null, 2)
  );

  await browser.close();

  // Print a small summary to stdout
  const bad = results.filter((x) => !x.ok);
  console.log(`QC complete. Pages checked: ${results.length}. Failures: ${bad.length}.`);
  for (const b of bad) console.log(`- FAIL ${b.path} status=${b.status} screenshot=${b.screenshot}`);
  if (pageErrors.length) console.log(`Page errors: ${pageErrors.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
