/**
 * Rollback to a saved snapshot
 *
 * Usage:
 *   cd C:/Projects/eliminai-cart-drawer/backend && node ../tests/rollback.js <timestamp>
 *   cd C:/Projects/eliminai-cart-drawer/backend && node ../tests/rollback.js list
 *   cd C:/Projects/eliminai-cart-drawer/backend && node ../tests/rollback.js latest
 *
 * This restores:
 *   - Live theme JS from snapshot
 *   - Demo theme JS from snapshot
 *   - Does NOT restore discounts (too risky — do manually if needed)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const SNAPSHOTS_DIR = 'C:/Projects/eliminai-cart-drawer/snapshots';

async function rollback() {
  const arg = process.argv[2];

  if (!arg || arg === 'list') {
    const dirs = fs.readdirSync(SNAPSHOTS_DIR).filter(d =>
      fs.statSync(path.join(SNAPSHOTS_DIR, d)).isDirectory()
    ).sort().reverse();
    console.log('Available snapshots:');
    dirs.forEach(d => {
      const manifest = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, d, 'manifest.json'), 'utf8'));
      console.log(`  ${d} — ${manifest.description}`);
    });
    return;
  }

  let snapshotDir;
  if (arg === 'latest') {
    const dirs = fs.readdirSync(SNAPSHOTS_DIR).filter(d =>
      fs.statSync(path.join(SNAPSHOTS_DIR, d)).isDirectory()
    ).sort().reverse();
    if (dirs.length === 0) { console.log('No snapshots found'); return; }
    snapshotDir = path.join(SNAPSHOTS_DIR, dirs[0]);
  } else {
    snapshotDir = path.join(SNAPSHOTS_DIR, arg);
  }

  if (!fs.existsSync(snapshotDir)) {
    console.error('Snapshot not found:', snapshotDir);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'manifest.json'), 'utf8'));
  console.log('Rolling back to:', manifest.timestamp);
  console.log('Description:', manifest.description);

  const p = new PrismaClient();
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Restore live JS
  const liveFile = path.join(snapshotDir, 'live-v14-complete.js');
  if (fs.existsSync(liveFile)) {
    console.log('\nRestoring live theme JS...');
    const code = fs.readFileSync(liveFile, 'utf8');
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${manifest.live_theme}/assets.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const data = await res.json();
    if (data.errors) {
      console.error('  FAILED:', JSON.stringify(data.errors));
    } else {
      console.log('  Restored:', data.asset.key, '| size:', code.length);
    }
  }

  // Restore demo JS
  const demoFile = path.join(snapshotDir, 'demo-v14-complete.js');
  if (fs.existsSync(demoFile)) {
    console.log('Restoring demo theme JS...');
    const code = fs.readFileSync(demoFile, 'utf8');
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${manifest.demo_theme}/assets.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const data = await res.json();
    if (data.errors) {
      console.error('  FAILED:', JSON.stringify(data.errors));
    } else {
      console.log('  Restored:', data.asset.key, '| size:', code.length);
    }
  }

  console.log('\n✓ Rollback complete');
  console.log('NOTE: Discount configs were NOT rolled back — review discounts.json manually if needed');

  await p.$disconnect();
}

rollback().catch(e => { console.error(e); process.exit(1); });
