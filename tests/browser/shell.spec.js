import { test, expect } from '@playwright/test';
test('static WASM host and Material themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Linked Assets'})).toBeVisible();
  await page.getByRole('button', {name:'Dark theme'}).click();
  await expect(page.locator('.mj-dark')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', {name:'Light theme'})).toBeVisible();
});
