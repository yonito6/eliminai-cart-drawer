const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const code = fs.readFileSync('C:/Projects/eliminai-cart-drawer/v14-live-current.js', 'utf8');
  require('./pre-upload-gate')(code, 'upload-fix-live → LIVE+DEMO');
  console.log('Uploading fixed v14 to LIVE theme | Size:', code.length, 'bytes');

  const res = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158577557755/assets.json', {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('Upload errors:', JSON.stringify(data.errors));
  } else {
    console.log('Uploaded to LIVE:', data.asset?.key, '| updated_at:', data.asset?.updated_at);
  }

  // Also upload to DEMO theme to keep them in sync
  console.log('Uploading fixed v14 to DEMO theme...');
  const res2 = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158622155003/assets.json', {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
  });
  const data2 = await res2.json();
  if (data2.errors) {
    console.error('DEMO Upload errors:', JSON.stringify(data2.errors));
  } else {
    console.log('Uploaded to DEMO:', data2.asset?.key, '| updated_at:', data2.asset?.updated_at);
  }

  await p.$disconnect();
})();
