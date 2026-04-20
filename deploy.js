#!/usr/bin/env node
/**
 * Cart Drawer Deploy Script — Safe deployment pipeline
 *
 * Usage:
 *   node deploy.js              → tests + test store + Eleganto DEMO only
 *   node deploy.js --live       → tests + test store + Eleganto DEMO + LIVE
 *   node deploy.js --test-only  → tests + test store only (no Eleganto)
 *   node deploy.js --skip-tests → skip tests (DANGEROUS — use only for hotfixes)
 *
 * Pipeline:
 *   1. Run all 351 tests (contract + bug regression + behavior shield)
 *   2. Upload to test store (eliminai-test) — all themes
 *   3. Upload to Eleganto DEMO theme
 *   4. Only with --live: Upload to Eleganto LIVE theme (real customers!)
 */

const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const { execSync } = require('child_process');
const p = new PrismaClient();

const args = process.argv.slice(2);
const DEPLOY_LIVE = args.includes('--live');
const TEST_ONLY = args.includes('--test-only');
const SKIP_TESTS = args.includes('--skip-tests');

const ELEGANTO_DOMAIN = 'eleganto-3011.myshopify.com';
const TEST_DOMAIN = 'eliminai-test.myshopify.com';

const ELEGANTO_THEMES = {
  DEMO: 158622155003,
  LIVE: 158577557755
};

async function uploadToStore(storeDomain, themeIds, code) {
  const store = await p.store.findFirst({
    where: { shopDomain: storeDomain },
    select: { accessToken: true, shopDomain: true }
  });

  if (!store) {
    console.log('  SKIP — store ' + storeDomain + ' not found in DB');
    return;
  }

  for (const [label, themeId] of Object.entries(themeIds)) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const data = await res.json();
    if (data.asset) {
      console.log('  ' + label + ': uploaded (' + code.length + ' bytes)');
    } else {
      console.log('  ' + label + ': ERROR — ' + JSON.stringify(data.errors || data));
    }
  }
}

async function uploadToAllTestThemes(code) {
  const store = await p.store.findFirst({
    where: { shopDomain: TEST_DOMAIN },
    select: { accessToken: true, shopDomain: true }
  });

  if (!store) {
    console.log('  SKIP — test store not found in DB');
    return;
  }

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();

  for (const theme of data.themes) {
    const upRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + theme.id + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const upData = await upRes.json();
    if (upData.asset) {
      console.log('  ' + theme.name + ' (' + theme.role + '): uploaded');
    } else {
      console.log('  ' + theme.name + ': ERROR — ' + JSON.stringify(upData.errors || upData));
    }
  }
}

async function deploy() {
  console.log('');
  console.log('=== Cart Drawer Deploy ===');
  console.log('Mode: ' + (DEPLOY_LIVE ? 'DEMO + LIVE (production!)' : TEST_ONLY ? 'Test store only' : 'DEMO only (safe)'));
  console.log('');

  // Step 1: Tests
  if (!SKIP_TESTS) {
    console.log('Step 1/3: Running tests...');
    try {
      execSync('node tests/pre-upload-gate.js', { stdio: 'inherit', timeout: 30000, cwd: __dirname });
    } catch (e) {
      console.error('\nDEPLOY ABORTED — fix failing tests first!');
      process.exit(1);
    }
    console.log('');
  } else {
    console.log('Step 1/3: Tests SKIPPED (--skip-tests)\n');
  }

  const code = fs.readFileSync(__dirname + '/v14-complete.js', 'utf8');
  console.log('File: v14-complete.js (' + code.length + ' bytes)\n');

  // Step 2: Test store
  console.log('Step 2/3: Test store (' + TEST_DOMAIN + ')');
  await uploadToAllTestThemes(code);
  console.log('');

  // Step 3: Eleganto
  if (!TEST_ONLY) {
    var targets = { DEMO: ELEGANTO_THEMES.DEMO };
    if (DEPLOY_LIVE) {
      targets.LIVE = ELEGANTO_THEMES.LIVE;
    }

    console.log('Step 3/3: Eleganto (' + ELEGANTO_DOMAIN + ')');
    if (!DEPLOY_LIVE) {
      console.log('  (LIVE skipped — add --live to deploy to production)');
    }
    await uploadToStore(ELEGANTO_DOMAIN, targets, code);
  } else {
    console.log('Step 3/3: Eleganto SKIPPED (--test-only)');
  }

  console.log('\n=== Deploy complete ===\n');
  await p.$disconnect();
}

deploy().catch(function(e) { console.error(e); p.$disconnect(); process.exit(1); });
