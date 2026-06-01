#!/usr/bin/env node
/**
 * Header Section — seed-from-real-values + make-every-setting-work tests.
 *
 * BLAST RADIUS MAP — Header editor parity (seed + live + preview)
 * Target: header apply block in v14-complete.js (applyEditorOverrides),
 *         preview header transform in preview-renderer.ts,
 *         CART_DEFAULTS.header in defaults.ts,
 *         header-editor.tsx control seeding.
 *
 * DUPLICATED LOGIC:
 *   - v14-complete.js (root)  applyEditorOverrides header block
 *   - extensions/cart-drawer/assets/v14-complete.js  (identical copy)
 *   - preview-renderer.ts  must mirror the SAME field → style mapping
 *
 * SHARED STATE / SILENT NO-OPS FIXED (were in editor but did nothing live):
 *   - header.borderStyle (none/line/shadow) — never applied
 *   - header.heightPreset (slim/tall) — never applied
 *   - header.padding — applied as modifier class with NO CSS (no-op)
 *   - header.closeButton.iconSize — modifier class with NO CSS (no-op)
 *   - header.closeIcon (x/chevron/arrow) — never swapped the svg
 *   - header.showItemCountBadge + badgeColor — no badge element existed
 *
 * CROSS-PATH RISK:
 *   - Fix v14 root but not extension copy → live drawer diverges per deploy path
 *   - Fix v14 but not preview-renderer → dashboard preview ≠ live cart
 *
 * Usage: node tests/header-section.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log('  \u2717 ' + name); console.log('    ' + err.message); }
}
function assertContains(code, pattern, message) {
  if (!code.includes(pattern)) throw new Error(message + '\n    Missing: "' + pattern.substring(0, 120) + '"');
}
function assertNotContains(code, pattern, message) {
  if (code.includes(pattern)) throw new Error(message + '\n    Found forbidden: "' + pattern.substring(0, 120) + '"');
}
function assertRegex(code, regex, message) {
  if (!regex.test(code)) throw new Error(message + '\n    Pattern not found: ' + regex);
}

const ROOT = path.resolve(__dirname, '..');
const v14Root = fs.readFileSync(path.join(ROOT, 'v14-complete.js'), 'utf8');
const v14Ext = fs.readFileSync(path.join(ROOT, 'extensions', 'cart-drawer', 'assets', 'v14-complete.js'), 'utf8');
const defaults = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'lib', 'cart-editor', 'defaults.ts'), 'utf8');
const preview = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'app', 'dashboard', 'cart-editor', 'preview-renderer.ts'), 'utf8');

console.log('\nHeader Section Tests');
console.log('='.repeat(60));

console.log('\n--- defaults.ts: CART_DEFAULTS.header seeded from REAL cart values ---');
test('defaults exports CART_DEFAULTS.header', () => {
  assertRegex(defaults, /header:\s*\{/, 'CART_DEFAULTS must contain a header object');
});
test('header real defaults match the live cart (title/size/weight/color/padding)', () => {
  assertContains(defaults, "title: 'Your cart'", "title default must be 'Your cart' (matches v14 render)");
  assertContains(defaults, 'titleFontSize: 22', 'titleFontSize default must be 22 (matches .ccd-title CSS)');
  assertContains(defaults, "titleFontWeight: 'bold'", 'titleFontWeight default bold (700)');
  assertContains(defaults, "titleColor: '#111111'", 'titleColor default #111111');
  assertContains(defaults, "padding: 'comfortable'", 'padding default comfortable (20px 20px 8px)');
  assertContains(defaults, "borderStyle: 'none'", 'borderStyle default none');
  assertContains(defaults, "closeIcon: 'x'", 'closeIcon default x');
});
test('defaults exports HEADER_PADDING / HEADER_MIN_HEIGHT / CLOSE_ICON_SIZE_PX / CLOSE_ICON_SVG + renderCloseIcon', () => {
  assertRegex(defaults, /export const HEADER_PADDING[^=]*=/, 'HEADER_PADDING map required');
  assertContains(defaults, "comfortable: '20px 20px 8px'", 'comfortable padding must equal current 20px 20px 8px');
  assertRegex(defaults, /export const HEADER_MIN_HEIGHT[^=]*=/, 'HEADER_MIN_HEIGHT map required');
  assertRegex(defaults, /export const CLOSE_ICON_SIZE_PX[^=]*=/, 'CLOSE_ICON_SIZE_PX map required');
  assertRegex(defaults, /export const CLOSE_ICON_SVG[^=]*=/, 'CLOSE_ICON_SVG map required (x/chevron/arrow)');
  assertRegex(defaults, /export function renderCloseIcon/, 'renderCloseIcon helper required');
});

for (const [label, code] of [['v14 ROOT', v14Root], ['v14 EXTENSION', v14Ext]]) {
  console.log(`\n--- ${label}: header no-op fixes ---`);
  test(`${label}: borderStyle none/line/shadow applied inline (was never applied)`, () => {
    assertRegex(code, /h\.borderStyle\s*===\s*['"]line['"]/, 'borderStyle line branch required');
    assertRegex(code, /headerEl\.style\.borderBottom\s*=/, 'borderStyle must set headerEl.style.borderBottom');
    assertRegex(code, /headerEl\.style\.boxShadow\s*=/, 'shadow style must set headerEl.style.boxShadow');
  });
  test(`${label}: padding applied inline via CCD_HEADER_PADDING (broken modifier class removed)`, () => {
    assertContains(code, 'CCD_HEADER_PADDING', 'must use CCD_HEADER_PADDING map');
    assertRegex(code, /headerEl\.style\.padding\s*=\s*CCD_HEADER_PADDING/, 'padding must be applied inline');
    assertNotContains(code, "'ccd-header--' + h.padding", 'broken modifier-class padding no-op must be removed');
  });
  test(`${label}: heightPreset applied inline via CCD_HEADER_MIN_HEIGHT`, () => {
    assertContains(code, 'CCD_HEADER_MIN_HEIGHT', 'must use CCD_HEADER_MIN_HEIGHT map');
    assertRegex(code, /headerEl\.style\.minHeight\s*=/, 'heightPreset must set headerEl.style.minHeight');
  });
  test(`${label}: closeIcon swaps the svg via CCD_CLOSE_ICON_SVG (was never swapped)`, () => {
    assertContains(code, 'CCD_CLOSE_ICON_SVG', 'must define CCD_CLOSE_ICON_SVG map');
    assertRegex(code, /btn\.innerHTML\s*=\s*CCD_CLOSE_ICON_SVG/, 'closeIcon must swap btn.innerHTML');
    assertRegex(code, /h\.closeIcon\s*===\s*['"]chevron['"]/, 'closeIcon must handle chevron');
  });
  test(`${label}: close icon size applied inline (broken modifier class removed)`, () => {
    assertContains(code, 'CCD_CLOSE_ICON_SIZE', 'must use CCD_CLOSE_ICON_SIZE map');
    assertRegex(code, /\.style\.width\s*=\s*CCD_CLOSE_ICON_SIZE/, 'iconSize must set svg.style.width inline');
    assertNotContains(code, "btn.classList.add('ccd-close-btn--s')", 'broken iconSize modifier-class no-op must be removed');
  });
  test(`${label}: item-count badge element is created + shown (no badge existed before)`, () => {
    assertContains(code, 'ccd-title-badge', 'must create a .ccd-title-badge element');
    assertRegex(code, /h\.showItemCountBadge\s*===\s*true/, 'must toggle on showItemCountBadge === true');
    assertRegex(code, /\.ccd-title-badge\s*\{/, 'must ship base CSS for .ccd-title-badge pill');
  });
}

console.log('\n--- preview-renderer.ts: mirrors header fields (preview === live) ---');
test('preview imports header maps + renderCloseIcon from defaults', () => {
  assertRegex(preview, /import\s*\{[^}]*HEADER_PADDING[^}]*\}\s*from\s*['"]@\/lib\/cart-editor\/defaults['"]/, 'preview must import HEADER_PADDING');
  assertContains(preview, 'renderCloseIcon', 'preview must import renderCloseIcon');
});
test('preview applies title color/size/weight + header bg/padding inline', () => {
  assertRegex(preview, /drawer__title/, 'preview must target .drawer__title');
  assertContains(preview, 'HEADER_PADDING', 'preview must apply HEADER_PADDING to the header container');
  assertRegex(preview, /titleColor|titleFontSize|titleFontWeight/, 'preview must apply title typography overrides');
});
test('preview swaps close icon + renders item-count badge', () => {
  assertContains(preview, 'ccd-title-badge', 'preview must render the item-count badge pill');
  assertRegex(preview, /closeIcon/, 'preview must swap the close icon');
});

console.log('\n' + '='.repeat(60));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) { console.log('\n\u2717 Header section incomplete'); process.exit(1); }
else { console.log('\n\u2713 Header section: seed + live + preview all in parity'); }
