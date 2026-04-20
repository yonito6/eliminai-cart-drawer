#!/usr/bin/env node
/**
 * Deploy backend to Railway staging or production.
 *
 * Usage:
 *   node deploy-backend.js            → deploy to STAGING (safe default)
 *   node deploy-backend.js --production  → deploy to PRODUCTION
 *   node deploy-backend.js --status      → show current Railway link status
 */
const { execSync } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, 'backend');
const args = process.argv.slice(2);

const isProduction = args.includes('--production') || args.includes('-p');
const isStatus = args.includes('--status') || args.includes('-s');

const ENV = isProduction ? 'production' : 'staging';
const SERVICE = isProduction ? 'eliminai-cart-drawer' : 'eliminai-cart-staging';

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  try {
    return execSync(cmd, { cwd: BACKEND_DIR, stdio: 'inherit', ...opts });
  } catch (e) {
    if (!opts.ignoreError) {
      console.error(`\nCommand failed: ${cmd}`);
      process.exit(1);
    }
  }
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { cwd: BACKEND_DIR, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// --- Status command ---
if (isStatus) {
  console.log('\n  Railway status:\n');
  run('railway status');
  process.exit(0);
}

// --- Deploy ---
console.log(`\n  Deploying to ${ENV.toUpperCase()}...\n`);

// Step 1: TypeScript check
console.log('  [1/4] TypeScript check...');
run('npx tsc --noEmit');

// Step 2: Link to target environment
console.log(`\n  [2/4] Linking to ${ENV}...`);
run(`railway environment link ${ENV}`);
run(`railway service ${SERVICE}`);

// Step 3: Deploy
console.log(`\n  [3/4] Deploying to Railway (${ENV})...`);
run('railway up --detach');

// Step 4: Switch back to production (safety — CLI should always default to production)
if (!isProduction) {
  console.log('\n  [4/4] Switching CLI back to production (safety)...');
  run('railway environment link production');
  run('railway service eliminai-cart-drawer');
}

console.log(`\n  Done! Deployed to ${ENV.toUpperCase()}.`);

if (ENV === 'staging') {
  console.log('  URL: https://eliminai-cart-staging-staging.up.railway.app');
  console.log('\n  To deploy to production when ready:');
  console.log('    node deploy-backend.js --production\n');
} else {
  console.log('  URL: https://eliminai-cart-drawer-production.up.railway.app\n');
}
