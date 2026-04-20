/**
 * Save a snapshot of current working state BEFORE making changes
 *
 * Usage:
 *   cd C:/Projects/eliminai-cart-drawer/backend && node ../tests/snapshot.js "description of what im about to change"
 *
 * Saves: live JS, demo JS, discount configs, store config
 * Use rollback.js to restore if changes break something
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function snapshot() {
  const description = process.argv[2] || 'manual snapshot';
  const p = new PrismaClient();
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true, config: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const LIVE_THEME = '158577557755';
  const DEMO_THEME = '158622155003';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const dir = `C:/Projects/eliminai-cart-drawer/snapshots/${timestamp}`;
  fs.mkdirSync(dir, { recursive: true });

  // Download live JS
  console.log('Saving live theme JS...');
  const liveRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${LIVE_THEME}/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const liveData = await liveRes.json();
  fs.writeFileSync(`${dir}/live-v14-complete.js`, liveData.asset.value, 'utf8');

  // Download demo JS
  console.log('Saving demo theme JS...');
  const demoRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${DEMO_THEME}/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const demoData = await demoRes.json();
  fs.writeFileSync(`${dir}/demo-v14-complete.js`, demoData.asset.value, 'utf8');

  // Download discount configs
  console.log('Saving discount configs...');
  const discRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ automaticDiscountNodes(first: 50) { nodes { id automaticDiscount { ... on DiscountAutomaticBasic { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } } ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } } } } } }` })
  });
  fs.writeFileSync(`${dir}/discounts.json`, JSON.stringify((await discRes.json()).data, null, 2), 'utf8');

  // Save store config
  fs.writeFileSync(`${dir}/store-config.json`, JSON.stringify(store.config, null, 2), 'utf8');

  // Write manifest
  const manifest = {
    timestamp,
    description,
    live_theme: LIVE_THEME,
    demo_theme: DEMO_THEME,
    files: ['live-v14-complete.js', 'demo-v14-complete.js', 'discounts.json', 'store-config.json']
  };
  fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n✓ Snapshot saved: ${dir}`);
  console.log(`  Description: ${description}`);
  console.log(`  To rollback: node ../tests/rollback.js ${timestamp}`);

  await p.$disconnect();
}

snapshot().catch(e => { console.error(e); process.exit(1); });
