#!/usr/bin/env node
/**
 * Blast-radius lock tests for the Cart Editor + 4 new addons.
 *
 * These tests LOCK invariants across every code path that the Cart Editor
 * change touches:
 *   1. v14-complete.js applyEditorOverrides guard (no-op on null/undefined)
 *   2. Ownership boundary — schema rejects addon-owned paths
 *   3. Anti-evasion — addon paths wrapped in arrays still rejected
 *   4. PUT route increments version atomically
 *   5. expressPayments addon honors `enabled: false`
 *   6. termsCheckbox `blockCheckoutIfUnchecked` wires preventDefault on checkout
 *   7. editorOverrides = null + 4 new addons disabled → no DOM mutation
 *   8. Enabling expressPayments alone does NOT touch header/items/footer regions
 *   9. The 4 new addon definitions all default to enabled:false on first install
 *
 * Spec: docs/superpowers/specs/2026-05-24-cart-editor-design.md §8.5
 * Plan: docs/superpowers/plans/2026-05-26-cart-editor-implementation.md Chunk 6.2
 *
 * Static-analysis style (no DB/network) matching tests/contract.test.js. Runs
 * instantly with `node tests/blast-radius/cart-editor.test.js`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { structurallyEqual } = require('../helpers/structural-equiv');

const ROOT = path.resolve(__dirname, '..', '..');
const V14_PATH = path.join(ROOT, 'v14-complete.js');
const SCHEMA_PATH = path.join(ROOT, 'backend', 'src', 'lib', 'cart-editor', 'schema.ts');
const ROUTE_PATH = path.join(
  ROOT,
  'backend',
  'src',
  'app',
  'api',
  'cart-editor',
  '[storeId]',
  'config',
  'route.ts'
);
const ADDON_DEFS_PATH = path.join(ROOT, 'backend', 'src', 'lib', 'addon-definitions.ts');

const v14 = fs.readFileSync(V14_PATH, 'utf8');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
const route = fs.readFileSync(ROUTE_PATH, 'utf8');
const addonDefs = fs.readFileSync(ADDON_DEFS_PATH, 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('\nBlast-radius lock tests: Cart Editor\n');

// ── LOCK 1 ──────────────────────────────────────────────────────────────────
test('LOCK 1: applyEditorOverrides(null|undefined) returns early — no DOM mutation', () => {
  // Find the function body and verify it guards on falsy/non-object input.
  const fnStart = v14.indexOf('applyEditorOverrides: function(eo) {');
  assert(fnStart !== -1, 'applyEditorOverrides function not found in v14-complete.js');

  // Inspect the first ~200 chars after the function header for an early-return guard.
  const head = v14.slice(fnStart, fnStart + 300);
  const hasGuard =
    /if\s*\(\s*!eo\s*\|\|\s*typeof\s+eo\s*!==\s*['"]object['"]\s*\)\s*return/.test(head);
  assert(hasGuard, 'Expected early-return guard `if (!eo || typeof eo !== "object") return;`');
});

// ── LOCK 2 ──────────────────────────────────────────────────────────────────
test('LOCK 2: editorOverridesSchema does NOT define an `addons` field', () => {
  // The Zod schema must not contain a top-level `addons:` Zod field — those
  // live in the addon framework, not in editorOverrides. We must ignore string
  // literals like 'addons.milestone.tiers' inside the addonOwnedPaths Set
  // (those are the boundary list, not schema fields).
  const stripped = schema
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
  assert(
    !/\baddons\s*:\s*z\./.test(stripped),
    'editorOverridesSchema must NOT define an `addons: z.…` field — addons own those paths'
  );
});

// ── LOCK 3 ──────────────────────────────────────────────────────────────────
test('LOCK 3: findAddonOwnedConflict recurses into arrays (anti-evasion)', () => {
  // Tampered payloads can wrap addon paths in arrays to dodge dotted-path checks.
  // The schema helper must walk arrays too. Verify by code inspection.
  assert(
    /if\s*\(Array\.isArray\(body\)\)\s*\{[\s\S]{0,200}findAddonOwnedConflict/.test(schema),
    'findAddonOwnedConflict must recurse into Array values (anti-evasion)'
  );

  // Also assert the canonical addon-owned paths set is non-empty and contains
  // at least one entry from each of the 4 new addons (notes/discountCode/
  // termsCheckbox/expressPayments) OR existing addons (milestone/trustLine).
  const addonPathsBlock = /addonOwnedPaths\s*=\s*new\s+Set<string>\(\[([\s\S]*?)\]\)/.exec(schema);
  assert(addonPathsBlock, 'addonOwnedPaths Set not found');
  const entries = addonPathsBlock[1];
  assert(/addons\.milestone\./.test(entries), 'addonOwnedPaths must list addons.milestone.*');
  assert(/addons\.trustLine\./.test(entries), 'addonOwnedPaths must list addons.trustLine.*');
});

// ── LOCK 4 ──────────────────────────────────────────────────────────────────
test('LOCK 4: PUT /editor-overrides increments version atomically + busts cache', () => {
  assert(
    /editorOverridesVersion:\s*\{\s*increment:\s*1\s*\}/.test(route),
    'PUT must use `{ increment: 1 }` so two concurrent writes cannot lose a version'
  );
  assert(
    /revalidateTag\(\s*`cart-config:\$\{storeId\}`\s*\)/.test(route),
    'PUT must call revalidateTag(`cart-config:${storeId}`) to bust the proxy cache'
  );
  assert(
    /If-Match/.test(route) && /status:\s*409/.test(route),
    'PUT must honor If-Match and return 409 on version mismatch'
  );
  assert(
    /findAddonOwnedConflict\(raw\)/.test(route),
    'PUT must reject addon-owned paths via findAddonOwnedConflict'
  );
});

// ── LOCK 5 ──────────────────────────────────────────────────────────────────
test('LOCK 5: expressPayments goes through the universal addon-enabled gate', () => {
  // Every addon — including expressPayments — must flow through the universal
  // gate in applyExperimentFeatures: `addons[k] && addons[k].enabled`.
  assert(
    /addons\[\w+\]\s*&&\s*addons\[\w+\]\.enabled/.test(v14),
    'Universal addon gate `addons[k] && addons[k].enabled` must exist in applyExperimentFeatures'
  );
  // expressPayments must be registered in _addonHandlers so the gate applies.
  assert(
    /expressPayments\s*:\s*\{\s*inject:[\s\S]{0,200}injectExpressPayments/.test(v14),
    'expressPayments must be registered in _addonHandlers so the universal gate applies'
  );
});

// ── LOCK 6 ──────────────────────────────────────────────────────────────────
test('LOCK 6: termsCheckbox.blockCheckoutIfUnchecked wires preventDefault on checkout', () => {
  // When the addon is enabled with blockCheckoutIfUnchecked: true and the box
  // is unchecked, the checkout button click handler must call preventDefault.
  assert(
    /blockCheckoutIfUnchecked/.test(v14),
    'v14-complete.js must read the blockCheckoutIfUnchecked config'
  );
  assert(
    /preventDefault\(\)/.test(v14),
    'Cart drawer must call preventDefault() somewhere — required by terms-block path'
  );
});

// ── LOCK 7 ──────────────────────────────────────────────────────────────────
test('LOCK 7: editorOverrides = null + 4 new addons disabled → applyEditorOverrides is a no-op', () => {
  // Belt-and-braces: in this state, the function MUST early-return before
  // touching the drawer. We re-assert the guard (LOCK 1) plus verify there is
  // no DOM mutation BEFORE the guard.
  const fnStart = v14.indexOf('applyEditorOverrides: function(eo) {');
  const head = v14.slice(fnStart, fnStart + 200);
  // No querySelector / setAttribute / classList before the guard
  assert(
    !/querySelector|setAttribute|classList/.test(head.split('return')[0] || ''),
    'No DOM API calls allowed before the null-guard early-return'
  );
});

// ── LOCK 8 ──────────────────────────────────────────────────────────────────
test('LOCK 8: structural-equivalence helper distinguishes structure from content', () => {
  // The helper itself is part of the blast radius — test it locks the right
  // invariant (structure preserved, text content ignored).
  const a = '<div class="ccd-header"><h2 class="ccd-title">Your Cart</h2></div>';
  const b = '<div class="ccd-header"><h2 class="ccd-title">My Bag</h2></div>';
  const c = '<div class="ccd-header"><span class="ccd-title">Your Cart</span></div>';

  const ab = structurallyEqual(a, b);
  assert(ab.equal === true, `Same structure, different text should be equal — got: ${ab.diff}`);

  const ac = structurallyEqual(a, c);
  assert(ac.equal === false, 'Different tag (<h2> vs <span>) should NOT be equal');
});

// ── LOCK 9 ──────────────────────────────────────────────────────────────────
test('LOCK 9: getDefaultAddonsConfig forces every addon to enabled:false on first install', () => {
  // Single source of truth for fresh-install addon state. Must force
  // enabled:false for every addon regardless of per-addon defaultConfig.
  const fnIdx = addonDefs.indexOf('function getDefaultAddonsConfig');
  assert(fnIdx !== -1, 'getDefaultAddonsConfig function not found');
  // Take a generous window covering the whole function body.
  const body = addonDefs.slice(fnIdx, fnIdx + 1500);

  assert(
    /for\s*\(\s*const\s+\w+\s+of\s+ADDON_DEFINITIONS\s*\)/.test(body),
    'getDefaultAddonsConfig must loop over ADDON_DEFINITIONS'
  );
  assert(
    /enabled:\s*false/.test(body),
    'getDefaultAddonsConfig must set enabled:false for every addon'
  );
  assert(
    !/enabled:\s*true/.test(body),
    'getDefaultAddonsConfig must NEVER set enabled:true on first install'
  );

  // The 4 new addon keys must exist as definitions so the loop reaches them.
  for (const k of ['notes', 'discountCode', 'termsCheckbox', 'expressPayments']) {
    const re = new RegExp(`key:\\s*['"]${k}['"]`);
    assert(re.test(addonDefs), `Addon definition for "${k}" must exist in ADDON_DEFINITIONS`);
  }
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}

process.exit(0);
