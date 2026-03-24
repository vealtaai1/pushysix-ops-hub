import { test, expect } from "@playwright/test";
import { loginAsSeedAdmin } from "./_utils/auth";

/**
 * Ops v2 Analytics E2E
 *
 * Notes:
 * - Analytics is feature-flagged via OPS_V2_ANALYTICS_ENABLED.
 * - This test will auto-skip if the route returns 404 (flag off).
 */

test.describe("Ops v2 analytics", () => {
  test("loads dashboard, supports filters, and exports CSV", async ({ page }) => {
    await loginAsSeedAdmin(page);

    const resp = await page.goto("/ops/v2/analytics");
    if (resp && resp.status() === 404) {
      test.skip(true, "Analytics is disabled (OPS_V2_ANALYTICS_ENABLED is off)");
    }

    await expect(page.getByRole("heading", { level: 1, name: "Ops v2 — Analytics" })).toBeVisible();
    await expect(page.getByText("Worklog minutes over time.")).toBeVisible();

    // Chart cards / sections
    await expect(page.getByRole("heading", { level: 2, name: "Minutes by day" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Minutes by client" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Minutes by bucket" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Top users" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Top projects (client × bucket)" })).toBeVisible();

    // Heuristic: Recharts renders SVGs
    await expect(page.locator("svg").first()).toBeVisible();

    // Filter interactions: tweak From date and wait for analytics API response
    const filterCard = page.locator("section").first();

    const fromInput = filterCard
      .locator("label", { hasText: "From" })
      .locator("..")
      .locator('input[type="date"]');

    const toInput = filterCard
      .locator("label", { hasText: "To" })
      .locator("..")
      .locator('input[type="date"]');

    const clientSelect = filterCard
      .locator("label", { hasText: "Client" })
      .locator("..")
      .locator("select");

    const currentTo = await toInput.inputValue();
    // Move from 7 days earlier (simple and safe).
    const toDate = new Date(`${currentTo}T00:00:00.000Z`);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 7);
    const newFrom = fromDate.toISOString().slice(0, 10);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/ops/v2/analytics?") && r.status() === 200),
      fromInput.fill(newFrom),
    ]);

    // Select first real client option (skip "All clients").
    const options = await clientSelect.locator("option").all();
    if (options.length >= 2) {
      const realClientId = await options[1].getAttribute("value");
      if (realClientId) {
        await Promise.all([
          page.waitForResponse((r) => r.url().includes("/api/ops/v2/analytics?") && r.status() === 200),
          clientSelect.selectOption(realClientId),
        ]);
      }
    }

    // Clear filters
    const clearButton = page.getByRole("button", { name: "Clear" });
    if (await clearButton.count()) {
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/ops/v2/analytics?") && r.status() === 200),
        clearButton.click(),
      ]);
    }

    // Export CSV
    const exportBtn = page.getByRole("button", { name: "Export CSV" });
    await expect(exportBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((r) => r.url().includes("/api/ops/v2/analytics.csv") && r.status() === 200),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
