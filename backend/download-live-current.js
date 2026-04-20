const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();
  fs.writeFileSync('C:/Projects/eliminai-cart-drawer/snapshots/2026-04-14T14-36-33/live-CURRENT.js', data.asset.value, 'utf8');
  console.log('Downloaded current live JS:', data.asset.value.length, 'bytes');
  console.log('Updated:', data.asset.updated_at);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
