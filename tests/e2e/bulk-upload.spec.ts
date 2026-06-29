import { test, expect } from '@playwright/test';
import path from 'path';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin');
  await page.locator('input[type="email"]').fill('admin@gobaskit.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin/dashboard');
}

test.describe('GoBaskit E2E', () => {
  test('storefront home loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/GoBaskit|GoBaskit/i);
  });

  test('public products API returns JSON', async ({ request }) => {
    const res = await request.get('/api/products');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('public categories API returns JSON', async ({ request }) => {
    const res = await request.get('/api/categories');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

test.describe('Admin Bulk Upload', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('bulk upload page loads', async ({ page }) => {
    await page.goto('/admin/bulk-upload');
    await expect(page.getByRole('heading', { name: 'Bulk Product Upload' })).toBeVisible();
    await expect(page.getByTestId('start-upload-btn')).toBeVisible();
  });

  test('template download API (authenticated)', async ({ page }) => {
    await page.goto('/admin/bulk-upload');
    const response = await page.request.get('/api/admin/bulk-upload/template?format=csv');
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain('Product Name');
  });

  test('upload preview and inline edit flow', async ({ page }) => {
    await page.goto('/admin/bulk-upload');
    await page.getByTestId('start-upload-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const fixture = path.join(__dirname, 'fixtures', 'sample-products.csv');
    await page.locator('input[type="file"][accept*=".csv"]').setInputFiles(fixture);
    await page.getByTestId('preview-import-btn').click();

    await expect(page.getByTestId('import-preview')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Valid Products/)).toBeVisible();

    const nameCell = page.getByTestId('preview-row-2').getByRole('button', { name: /E2E Test Carrot/i });
    await nameCell.click();
    const input = page.getByTestId('preview-row-2').locator('input').first();
    await input.fill('E2E Edited Carrot');
    await input.press('Enter');

    await expect(page.getByRole('button', { name: /E2E Edited Carrot/i })).toBeVisible({ timeout: 10000 });
  });
});
