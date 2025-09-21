import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Tutorial Whitepaper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/tutorial`, { waitUntil: 'networkidle' });
  });

  test('renders hero section and first content area', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Meitra Tutorial' }),
    ).toBeVisible();
    await expect(
      page.getByText('Learn the strategic card game through comprehensive documentation.'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'ゲームの概要' }),
    ).toBeVisible();
  });

  test('allows navigating sections via sidebar', async ({ page }) => {
    await expect(page.getByText('目次')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ゲームの概要' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ブロー（宣言）システム' })).toBeVisible();

    await page.getByRole('button', { name: 'ブロー（宣言）システム' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'ブロー（宣言）システム' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'スートの強さ順' })).toBeVisible();
  });

  test('shows special systems and strategy tips', async ({ page }) => {
    await page.getByRole('button', { name: 'JOKERとジャックの特殊システム' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'JOKERとジャックの特殊システム' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'ジャックシステム詳細' }),
    ).toBeVisible();

    await page.getByRole('button', { name: '戦略とコツ' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '戦略とコツ' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'ブロー宣言戦略' })).toBeVisible();
  });
});
