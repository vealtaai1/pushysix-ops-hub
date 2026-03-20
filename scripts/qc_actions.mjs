import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QC_BASE_URL || "https://ops.pushysix.com";
const EMAIL = process.env.QC_EMAIL;
const PASSWORD = process.env.QC_PASSWORD;
const INVITE_EMAIL = process.env.QC_INVITE_EMAIL || "vealtaai1@gmail.com";

if (!EMAIL || !PASSWORD) {
  console.error("Missing QC_EMAIL or QC_PASSWORD env vars");
  process.exit(2);
}

const outDir = path.resolve(".qc-artifacts-actions");
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
  const apiCalls = [];

  page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => pageErrors.push(String(err?.stack || err)));
  page.on("response", async (res) => {
    const url = res.url();
    if (
      url.includes("/api/auth") ||
      url.includes("/api/admin/users/invite") ||
      url.includes("/api/admin") ||
      url.includes("/api/worklog")
    ) {
      const status = res.status();
      let bodyText = null;
      try {
        bodyText = await res.text();
      } catch {
        bodyText = null;
      }
      apiCalls.push({ url, status, body: bodyText?.slice(0, 2000) ?? null });
    }
  });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  // Use labels to avoid accidentally filling the wrong input.
  // Use click+type to ensure React onChange fires reliably.
  const emailInput = page.getByLabel("Email");
  await emailInput.click({ clickCount: 3 });
  await page.keyboard.type(EMAIL, { delay: 15 });

  const passInput = page.getByLabel("Password");
  await passInput.click({ clickCount: 3 });
  await page.keyboard.type(PASSWORD, { delay: 15 });

  await snap(page, "before_login_submit");

  await page.click('button[type="submit"]');

  // next-auth credentials sign-in may redirect client-side; wait for URL to change.
  try {
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30_000 });
  } catch {
    // still on login; capture what we can
  }

  await page.waitForTimeout(800);
  await snap(page, "after_login");

  // If we failed to leave /login, capture any visible error message and stop early.
  if (page.url().includes("/login")) {
    const errText = await page.textContent("body");
    fs.writeFileSync(path.join(outDir, "login_failed.txt"), (errText ?? "").slice(0, 4000));
    fs.writeFileSync(
      path.join(outDir, "results.json"),
      JSON.stringify({ base: BASE, inviteEmail: INVITE_EMAIL, apiCalls, consoleLines, pageErrors, note: "login_failed" }, null, 2),
    );
    console.log("Login did not complete; still on /login. See login_failed.txt + after_login.png + results.json");
    await browser.close();
    process.exit(1);
  }

  // Invite flow
  await page.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
  await snap(page, "admin_users_loaded");

  await page.fill('input[placeholder="employee@pushysix.com"], input[inputmode="email"]', INVITE_EMAIL);

  const inviteRespPromise = page
    .waitForResponse((r) => r.url().includes("/api/admin/users/invite"), { timeout: 30_000 })
    .catch(() => null);

  await page.click('button:has-text("Send invite")');

  const inviteResp = await inviteRespPromise;
  if (!inviteResp) {
    consoleLines.push("[error] Invite request was not observed within timeout.");
  }

  // Wait for status text to update
  await page.waitForTimeout(1500);
  await snap(page, "admin_users_after_invite");

  // Payroll page
  await page.goto(`${BASE}/admin/payroll`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await snap(page, "admin_payroll");

  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ base: BASE, inviteEmail: INVITE_EMAIL, apiCalls, consoleLines, pageErrors }, null, 2),
  );

  console.log(`Action QC complete. Artifacts in ${outDir}`);
  console.log(`Captured API calls: ${apiCalls.length}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
