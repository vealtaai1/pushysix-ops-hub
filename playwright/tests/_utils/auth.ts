import { expect, type Page } from '@playwright/test';

export async function loginAsSeedAdmin(page: Page) {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD in env. ' +
        'These are required for e2e login (Credentials provider).'
    );
  }

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);

  await Promise.all([
    page.waitForURL(/\/dashboard|\/ops|\/admin|\/portal|\/worklog/, { timeout: 30_000 }).catch(() => null),
    page.getByTestId('login-submit').click(),
  ]);

  // If we failed, the login page renders an error element.
  await expect(page.getByTestId('login-error')).toHaveCount(0);
}
