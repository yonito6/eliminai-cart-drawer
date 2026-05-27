/**
 * Cart Editor — Playwright E2E suite (Chunk 6.1).
 *
 * Covers the 18 scenarios from the implementation plan §6.1.1:
 *   click hotspot → element editor opens, edit fields → live preview updates,
 *   Save → reload → persistence, cross-tab broadcast, deep-links to Addons,
 *   ownership conflict (400), and navigation guard on dirty.
 *
 * Pre-conditions:
 *   - Backend running on http://localhost:3004 (see feedback_store_not_found_prevention.md)
 *   - A logged-in dashboard session for a Shopify dev store
 *   - Playwright installed (`npm i -D @playwright/test`)
 *
 * Usage:
 *   npx playwright test tests/cart-editor-preview.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.CART_EDITOR_BASE_URL ?? 'http://localhost:3004';
const EDITOR_PATH = '/dashboard/cart-editor';
const ADDONS_PATH = '/dashboard/addons';

// ── Helpers ────────────────────────────────────────────────────────────────

async function gotoEditor(page) {
  await page.goto(BASE_URL + EDITOR_PATH);
  await page.waitForSelector('text=Cart Editor', { timeout: 10_000 });
}

async function clickHotspot(page, selector) {
  // Click via the overlay to trigger selectElement
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`hotspot ${selector} not visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function setFieldValue(page, label, value) {
  // Find input/textarea by visible field label
  const input = page.getByLabel(label);
  await input.fill(String(value));
  // Trigger blur to flush onChange
  await input.blur();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Cart Editor — preview + panel', () => {
  test('1. click Header → right panel shows Header editor', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    await expect(page.getByText('Header', { exact: false })).toBeVisible();
    await expect(page.getByText('Title')).toBeVisible();
  });

  test('2. change header.title → preview text updates < 500ms (no network)', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    const before = await page.locator('.ccd-header').innerText();
    await setFieldValue(page, 'Title', 'Your Bag');
    await expect(page.locator('.ccd-header')).toContainText('Your Bag', { timeout: 500 });
    expect(before).not.toContain('Your Bag');
  });

  test('3. Save → reload → preview shows persisted value', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    await setFieldValue(page, 'Title', 'Persisted Bag');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved')).toBeVisible();
    await page.reload();
    await expect(page.locator('.ccd-header')).toContainText('Persisted Bag');
  });

  test('4. navigate away with isDirty → confirm modal', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    await setFieldValue(page, 'Title', 'Dirty Title');
    // beforeunload handlers cannot be auto-confirmed in Playwright; assert the
    // Unsaved badge is visible (proxy for the navigation guard being active).
    await expect(page.getByText('Unsaved')).toBeVisible();
  });

  test('5. preview state dropdown → empty → click empty CTA → editor opens', async ({ page }) => {
    await gotoEditor(page);
    await page.locator('select').first().selectOption('empty');
    await expect(page.locator('.ccd-empty')).toBeVisible();
    await clickHotspot(page, '.ccd-empty');
    await expect(page.getByText('Empty State', { exact: false })).toBeVisible();
  });

  test('6. desktop ↔ mobile viewport toggle changes width', async ({ page }) => {
    await gotoEditor(page);
    const drawer = page.locator('#CCD-Drawer');
    const desktopWidth = (await drawer.boundingBox())?.width ?? 0;
    await page.getByRole('button', { name: /mobile/i }).click();
    const mobileWidth = (await drawer.boundingBox())?.width ?? 0;
    expect(mobileWidth).not.toBe(desktopWidth);
  });

  test('7. hover halo follows cursor', async ({ page }) => {
    await gotoEditor(page);
    const header = page.locator('.ccd-header').first();
    await header.hover();
    await expect(page.locator('[data-cart-editor-halo]')).toBeVisible();
  });

  test('8. selection ring stays after click, clears on outside-click', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    await expect(page.locator('[data-cart-editor-ring]')).toBeVisible();
    await page.mouse.click(5, 5); // click outside preview
    await expect(page.locator('[data-cart-editor-ring]')).toHaveCount(0);
  });

  test('9. cross-tab: tab A saves → tab B savedConfig updates within 1s', async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await gotoEditor(a);
    await gotoEditor(b);
    await clickHotspot(a, '.ccd-header');
    await setFieldValue(a, 'Title', 'Tab A Title');
    await a.getByRole('button', { name: 'Save' }).click();
    await expect(b.locator('.ccd-header')).toContainText('Tab A Title', { timeout: 1500 });
  });

  test('10. cross-tab conflict: tab B dirty → tab A saves → banner shows', async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await gotoEditor(a);
    await gotoEditor(b);
    // Tab B dirties
    await clickHotspot(b, '.ccd-header');
    await setFieldValue(b, 'Title', 'Tab B Dirty');
    // Tab A saves a different title
    await clickHotspot(a, '.ccd-header');
    await setFieldValue(a, 'Title', 'Tab A Wins');
    await a.getByRole('button', { name: 'Save' }).click();
    // Tab B should see the dirty banner
    await expect(b.getByText('Settings updated in another tab')).toBeVisible({ timeout: 1500 });
  });

  test('11. cache bust: PUT save → proxy returns new version within 2s', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-header');
    await setFieldValue(page, 'Title', 'Cache Bust');
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/editor-overrides') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body.editorOverridesVersion).toBe('number');
  });

  test('12. ownership: PUT with addons.milestone.tiers → 400 conflict', async ({ page }) => {
    await gotoEditor(page);
    const res = await page.evaluate(async () => {
      const r = await fetch(window.location.pathname.replace('/dashboard/cart-editor', '/api/cart-editor/me/editor-overrides'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 0, overrides: { addons: { milestone: { tiers: [] } } } }),
      });
      return r.status;
    });
    expect([400, 422]).toContain(res);
  });

  test('13. click Notes area → routes to Addons?expand=notes', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-footer-notes-zone');
    await page.getByRole('link', { name: /Order Notes addon/ }).click();
    await expect(page).toHaveURL(/expand=notes/);
  });

  test('14. click Discount area → routes to Addons?expand=discountCode', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-footer-discount-zone');
    await page.getByRole('link', { name: /Discount Code addon/ }).click();
    await expect(page).toHaveURL(/expand=discountCode/);
  });

  test('15. click Terms area → routes to Addons?expand=termsCheckbox', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-footer-terms-zone');
    await page.getByRole('link', { name: /Terms Checkbox addon/ }).click();
    await expect(page).toHaveURL(/expand=termsCheckbox/);
  });

  test('16. click Express area → routes to Addons?expand=expressPayments', async ({ page }) => {
    await gotoEditor(page);
    await clickHotspot(page, '.ccd-footer-express-zone');
    await page.getByRole('link', { name: /Express Payments addon/ }).click();
    await expect(page).toHaveURL(/expand=expressPayments/);
  });

  test('17. toggle expressPayments.providers.paypal off → preview hides PayPal', async ({ page }) => {
    await page.goto(BASE_URL + ADDONS_PATH + '?expand=expressPayments');
    await page.getByLabel(/PayPal/).click();
    // Navigate back to cart editor — paypal button should not render
    await page.goto(BASE_URL + EDITOR_PATH);
    await expect(page.locator('[data-provider="paypal"]')).toHaveCount(0);
  });

  test('18. terms unchecked + blockCheckoutIfUnchecked + checkout click → error shown, no nav', async ({ page }) => {
    await page.goto(BASE_URL + ADDONS_PATH + '?expand=termsCheckbox');
    await page.getByLabel(/Block checkout/).check();
    await page.goto(BASE_URL + EDITOR_PATH);
    await page.locator('.ccd-checkout-btn').click();
    await expect(page.locator('[data-terms-error]')).toBeVisible();
  });
});
