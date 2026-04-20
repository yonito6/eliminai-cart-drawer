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
  const dir = 'C:/Projects/eliminai-cart-drawer/snapshots/2026-04-14T14-36-33';
  // Save the new live JS as post-fix
  const res = await fetch(`https://${domain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  fs.writeFileSync(dir + '/live-v14-complete-FIXED.js', data.asset.value, 'utf8');
  console.log('Saved post-fix live JS:', data.asset.value.length, 'bytes');
  // Verify the fix is in the code
  const code = data.asset.value;
  console.log('Has form-encoded gift add:', code.includes("application/x-www-form-urlencoded"));
  console.log('Has old JSON items gift add:', code.includes("JSON.stringify({ items: toAdd })"));
  await p.$disconnect();
}
snapshot().catch(e => { console.error(e); p.$disconnect(); });
