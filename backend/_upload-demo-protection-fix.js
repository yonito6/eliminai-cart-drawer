const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const code = fs.readFileSync('C:/Projects/eliminai-cart-drawer/backend/live-v14-complete.js', 'utf8');
  require('./pre-upload-gate')(code, 'protection optimistic total → DEMO only');

  // DEMO theme ONLY — never touch LIVE without explicit permission
  console.log('Uploading to DEMO theme | Size:', code.length, 'bytes');
  const res = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158622155003/assets.json', {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('Upload errors:', JSON.stringify(data.errors));
  } else {
    console.log('Uploaded to DEMO:', data.asset?.key, '| updated_at:', data.asset?.updated_at);
  }

  await p.$disconnect();
})();
