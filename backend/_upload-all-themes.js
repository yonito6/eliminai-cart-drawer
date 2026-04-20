const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const code = fs.readFileSync('_working-live-v14.js', 'utf8');
  const headers = { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' };
  const body = JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } });

  // LIVE theme
  console.log('Uploading to LIVE theme | Size: ' + code.length + ' bytes');
  var res = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158577557755/assets.json', { method: 'PUT', headers, body });
  var data = await res.json();
  if (data.errors) console.error('LIVE errors:', JSON.stringify(data.errors));
  else console.log('LIVE:', data.asset.key, '| updated_at:', data.asset.updated_at);

  // DEMO theme
  console.log('Uploading to DEMO theme...');
  var res2 = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158622155003/assets.json', { method: 'PUT', headers, body });
  var data2 = await res2.json();
  if (data2.errors) console.error('DEMO errors:', JSON.stringify(data2.errors));
  else console.log('DEMO:', data2.asset.key, '| updated_at:', data2.asset.updated_at);

  await p.$disconnect();
})();
