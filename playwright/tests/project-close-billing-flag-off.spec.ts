import { test, expect } from '@playwright/test';
import { loginAsSeedAdmin } from './_utils/auth';

async function bootstrapClient(page: import('@playwright/test').Page): Promise<{ id: string; name: string }> {
  const res = await page.request.post('/api/admin/bootstrap');
  const json = await res.json();
  expect(res.ok()).toBeTruthy();
  expect(json.ok).toBeTruthy();
  return { id: String(json.client.id), name: String(json.client.name) };
}

test.describe('Ops v2 project close', () => {
  test('closing a project does not claim billing email was sent when flag is off', async ({ page }) => {
    await loginAsSeedAdmin(page);

    const client = await bootstrapClient(page);

    await page.goto(`/ops/v2/clients/${client.id}`);
    await expect(page.getByRole('heading', { name: client.name })).toBeVisible();

    // Add a project.
    await page.getByRole('button', { name: 'Add project' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add project')).toBeVisible();

    const uniqueName = `E2E Project ${Date.now()}`;
    await dialog.locator('input[name="name"]').fill(uniqueName);
    await dialog.getByRole('button', { name: 'Create project' }).click();

    // Server action triggers reload on success.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Close the project.
    const projectRow = page.locator('div.grid.grid-cols-12', { hasText: uniqueName }).first();
    await expect(projectRow).toBeVisible();

    await projectRow.getByRole('button', { name: 'Close' }).click();

    await page.waitForLoadState('networkidle');

    // Message should be the feature-flag-off variant.
    // When BILLING_CLOSE_EMAIL_ENABLED is false, closeProject returns "Project closed.".
    const msg = page.getByText(/Project closed\./);
    await expect(msg).toBeVisible();

    // Guard: do not show any "Billing email" sent message in this default configuration.
    await expect(page.getByText(/Billing email sent|billing email/i)).toHaveCount(0);
  });
});
