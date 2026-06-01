#!/usr/bin/env node
/**
 * Milestone Bar Section — seed-from-real-values + make-every-setting-work tests.
 *
 * BLAST RADIUS MAP — Milestone bar editor parity (seed + live + preview)
 * Target: milestoneBar CONSUMPTION in v14-complete.js (CSS + updateProgress render),
 *         milestoneBar transform in preview-renderer.ts,
 *         CART_DEFAULTS.milestoneBar in defaults.ts,
 *         milestone-editor.tsx control seeding.
 *
 * APPLY SIDE (already correct + contract-locked at tests/contract.test.js:3179-3218):
 *   - applyEditorOverrides milestoneBar block SETS:
 *       --ccd-progress-fill / --ccd-progress-bg / --ccd-progress-height
 *       --ccd-progress-text-size / --ccd-progress-text-weight (CSS vars)
 *       data-pre-unlock / data-unlocked / data-position (data attrs)
 *       .ccd-progress--no-celebrate (class)
 *   - DO NOT change the apply block — only the CONSUMPTION of these values.
 *
 * DUPLICATED LOGIC:
 *   - v14-complete.js (root)  embedded CSS + updateProgress
 *   - extensions/cart-drawer/assets/v14-complete.js  (identical copy)
 *   - preview-renderer.ts  must mirror the SAME field -> style mapping
 *
 * SILENT NO-OPS FIXED (set by apply block but never consumed):
 *   - fillColor (--ccd-progress-fill) — CSS hardcoded var(--ccd-primary,#111) / #111
 *   - height (--ccd-progress-height) — CSS hardcoded 3px
 *   - textSize (--ccd-progress-text-size) — CSS hardcoded 15px
 *   - textWeight (--ccd-progress-text-weight) — CSS had no weight on message
 *   - celebrationAnim (.ccd-progress--no-celebrate) — no CSS existed for the class
 *   - preUnlockTemplate / unlockedTemplate (data-pre-unlock/-unlocked) — render never read them
 *   - position (data-position) — element never relocated
 *
 * CROSS-PATH RISK:
 *   - Fix v14 root but not extension copy -> live drawer diverges per deploy path
 *   - Fix v14 but not preview-renderer -> dashboard preview != live cart
 *   - trackColor (--ccd-progress-bg) ALREADY works — must stay working
 *
 * Usage: node tests/milestone-section.test.js
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
function assertRegex(code, regex, message) {
  if (!regex.test(code)) throw new Error(message + '\n    Pattern not found: ' + regex);
}

const ROOT = path.resolve(__dirname, '..');
const v14Root = fs.readFileSync(path.join(ROOT, 'v14-complete.js'), 'utf8');
const v14Ext = fs.readFileSync(path.join(ROOT, 'extensions', 'cart-drawer', 'assets', 'v14-complete.js'), 'utf8');
const defaults = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'lib', 'cart-editor', 'defaults.ts'), 'utf8');
const preview = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'app', 'dashboard', 'cart-editor', 'preview-renderer.ts'), 'utf8');

console.log('\nMilestone Bar Section Tests');
console.log('='.repeat(60));

console.log('\n--- defaults.ts: CART_DEFAULTS.milestoneBar seeded from REAL cart values ---');
test('defaults exports CART_DEFAULTS.milestoneBar', () => {
  assertRegex(defaults, /milestoneBar:\s*\{/, 'CART_DEFAULTS must contain a milestoneBar object');
});
test('milestoneBar real defaults match the live cart', () => {
  assertContains(defaults, "fillColor: '#111111'", "fillColor default must be #111111 (matches reached icon/fill)");
  assertContains(defaults, "trackColor: '#dddddd'", 'trackColor default #dddddd (matches --ccd-progress-bg fallback)');
  assertContains(defaults, 'height: 3', 'height default 3 (matches .ccd-progress__line 3px)');
  assertContains(defaults, 'textSize: 15', 'textSize default 15 (matches .ccd-progress__message 15px)');
  assertContains(defaults, 'textWeight: 400', 'textWeight default 400 (normal)');
  assertContains(defaults, "position: 'top'", 'position default top (current placement)');
  assertContains(defaults, 'celebrationAnim: true', 'celebrationAnim default true (animation currently plays)');
});

for (const [label, code] of [['v14 ROOT', v14Root], ['v14 EXTENSION', v14Ext]]) {
  console.log(`\n--- ${label}: milestone consumption fixes (silent no-ops) ---`);
  test(`${label}: fillColor consumed — line::after + icon--reached read --ccd-progress-fill`, () => {
    assertContains(code, 'var(--ccd-progress-fill,', 'fill CSS must read --ccd-progress-fill var');
    assertRegex(code, /ccd-progress__icon--reached \{ background: var\(--ccd-progress-fill, #111\)/,
      '.ccd-progress__icon--reached background must read --ccd-progress-fill');
  });
  test(`${label}: trackColor still consumed via --ccd-progress-bg (must stay working)`, () => {
    assertContains(code, 'var(--ccd-progress-bg, #ddd)', 'track CSS must keep reading --ccd-progress-bg');
  });
  test(`${label}: height consumed — line reads --ccd-progress-height`, () => {
    assertContains(code, 'var(--ccd-progress-height, 3px)', '.ccd-progress__line height must read --ccd-progress-height');
  });
  test(`${label}: textSize + textWeight consumed by .ccd-progress__message`, () => {
    assertContains(code, 'var(--ccd-progress-text-size, 15px)', 'message font-size must read --ccd-progress-text-size');
    assertContains(code, 'var(--ccd-progress-text-weight,', 'message font-weight must read --ccd-progress-text-weight');
  });
  test(`${label}: celebrationAnim off — .ccd-progress--no-celebrate disables the animation`, () => {
    assertRegex(code, /\.ccd-progress--no-celebrate[^\n]*ccd-progress__icon--reached[^\n]*animation: none/,
      'must ship CSS that turns off the reached-icon animation when --no-celebrate is set');
  });
  test(`${label}: templates consumed — render reads data-pre-unlock / data-unlocked`, () => {
    assertContains(code, "getAttribute('data-pre-unlock')", 'updateProgress must read data-pre-unlock template');
    assertContains(code, "getAttribute('data-unlocked')", 'updateProgress must read data-unlocked template');
    assertContains(code, '{{amount}}', 'pre-unlock template must substitute {{amount}}');
    assertContains(code, '{{tierName}}', 'templates must substitute {{tierName}}');
  });
  test(`${label}: position consumed — apply block relocates the bar element by data-position`, () => {
    assertContains(code, 'CCD_relocateProgress', 'apply must call a relocation helper that moves .ccd-progress by position');
    assertRegex(code, /function CCD_relocateProgress[\s\S]{0,400}aboveCheckout[\s\S]{0,200}insertBefore/,
      'CCD_relocateProgress must insertBefore the footer when position is aboveCheckout');
  });
}

console.log('\n--- preview-renderer.ts: mirrors milestone fields (preview === live) ---');
test('preview imports milestone maps/defaults if needed and targets .ccd-progress', () => {
  assertContains(preview, 'ccd-progress', 'preview must target the .ccd-progress bar');
});
test('preview applies fill/track/height/text + celebration + templates + position', () => {
  assertContains(preview, '--ccd-progress-fill', 'preview must set --ccd-progress-fill');
  assertContains(preview, '--ccd-progress-bg', 'preview must set --ccd-progress-bg');
  assertContains(preview, '--ccd-progress-height', 'preview must set --ccd-progress-height');
  assertContains(preview, '--ccd-progress-text-size', 'preview must set --ccd-progress-text-size');
  assertContains(preview, '--ccd-progress-text-weight', 'preview must set --ccd-progress-text-weight');
  assertRegex(preview, /no-celebrate|celebrationAnim/, 'preview must reflect celebrationAnim');
  assertRegex(preview, /preUnlockTemplate|unlockedTemplate|\{\{amount\}\}/, 'preview must reflect templates');
  assertRegex(preview, /aboveCheckout|position/, 'preview must reflect position');
});

console.log('\n' + '='.repeat(60));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) { console.log('\n\u2717 Milestone section incomplete'); process.exit(1); }
else { console.log('\n\u2713 Milestone section: seed + live + preview all in parity'); }
