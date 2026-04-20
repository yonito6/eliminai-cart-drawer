const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function snapshot() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const LIVE_THEME = '158577557755';
  const DEMO_THEME = '158622155003';
  const snapshotDir = 'C:/Projects/eliminai-cart-drawer/snapshots';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const dir = snapshotDir + '/' + timestamp;
  fs.mkdirSync(dir, { recursive: true });

  // 1. Snapshot live JS
  console.log('Downloading live theme JS...');
  const liveRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${LIVE_THEME}/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const liveData = await liveRes.json();
  fs.writeFileSync(dir + '/live-v14-complete.js', liveData.asset.value, 'utf8');
  console.log('  Saved live JS:', liveData.asset.value.length, 'bytes');

  // 2. Snapshot demo JS
  console.log('Downloading demo theme JS...');
  const demoRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${DEMO_THEME}/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const demoData = await demoRes.json();
  fs.writeFileSync(dir + '/demo-v14-complete.js', demoData.asset.value, 'utf8');
  console.log('  Saved demo JS:', demoData.asset.value.length, 'bytes');

  // 3. Snapshot all discount configs
  console.log('Downloading discount configs...');
  const discRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNodes(first: 50) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
            ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
          }
        }
      }
    }` })
  });
  const discData = await discRes.json();
  fs.writeFileSync(dir + '/discounts.json', JSON.stringify(discData.data, null, 2), 'utf8');
  console.log('  Saved discount config');

  // 4. Snapshot store config (tiers, gift settings)
  const storeConfig = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { config: true }
  });
  fs.writeFileSync(dir + '/store-config.json', JSON.stringify(storeConfig.config, null, 2), 'utf8');
  console.log('  Saved store config');

  // 5. Write manifest
  const manifest = {
    timestamp,
    description: 'Working state: discount fix (Basic no-min), form-encoded add, gift tiers',
    live_theme: LIVE_THEME,
    demo_theme: DEMO_THEME,
    files: ['live-v14-complete.js', 'demo-v14-complete.js', 'discounts.json', 'store-config.json']
  };
  fs.writeFileSync(dir + '/manifest.json', JSON.stringify(manifest, null, 2), 'utf8');
  
  console.log('\nSnapshot saved to:', dir);
  console.log('Manifest:', JSON.stringify(manifest, null, 2));

  await p.$disconnect();
}
snapshot().catch(e => { console.error(e); p.$disconnect(); });
