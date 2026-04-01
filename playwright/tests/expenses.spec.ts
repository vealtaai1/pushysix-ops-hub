import { test, expect } from '@playwright/test';
import { loginAsSeedAdmin } from './_utils/auth';

async function bootstrapClientId(page: import('@playwright/test').Page): Promise<string> {
  const res = await page.request.post('/api/admin/bootstrap');
  const json = await res.json();
  expect(res.ok()).toBeTruthy();
  expect(json.ok).toBeTruthy();
  expect(json.client?.id).toBeTruthy();
  return String(json.client.id);
}

test.describe('Ops expenses', () => {
  test('create (via API), list in UI, then delete via UI', async ({ page }) => {
    await loginAsSeedAdmin(page);

    const clientId = await bootstrapClientId(page);

    // Create an expense via API (bypasses receipt upload, which relies on Vercel Blob).
    // This still exercises server-side validation + persistence.
    const unique = `e2e-${Date.now()}`;
    const createRes = await page.request.post('/api/ops/v2/expenses', {
      data: {
        kind: 'MANUAL',
        clientId,
        expenseDate: new Date().toISOString().slice(0, 10),
        vendor: 'E2E Vendor',
        description: `E2E Expense ${unique}`,
        amount: '12.34',
        currency: 'CAD',
        notes: 'created by playwright',
        receiptUrl: `https://example.com/receipt/${unique}.pdf`,
      },
    });
    const createJson = await createRes.json();
    expect(createRes.ok()).toBeTruthy();
    expect(createJson.ok).toBeTruthy();
    const expenseId = String(createJson.item?.id ?? '');
    expect(expenseId).toBeTruthy();

    await page.goto('/ops/expenses');
    await expect(page.getByRole('heading', { name: 'Ops — Expenses' })).toBeVisible();

    // Verify listing shows our row.
    await expect(page.getByText(`E2E Expense ${unique}`)).toBeVisible();

    // Delete via UI (confirm dialog is used).
    page.on('dialog', (d) => d.accept());

    const row = page.locator('tr', { hasText: `E2E Expense ${unique}` });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Delete' }).click();

    // Table does a full page reload after delete.
    await page.waitForLoadState('networkidle');

    // Ensure it's gone.
    await expect(page.getByText(`E2E Expense ${unique}`)).toHaveCount(0);

    // (Optional) Assert the resource is really deleted.
    const getRes = await page.request.get(`/api/ops/v2/expenses/${expenseId}`);
    expect(getRes.status()).toBe(404);
  });
});
