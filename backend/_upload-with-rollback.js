const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const token = store.accessToken;
  const headers = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  // Save rollback backups
  const demoBackup = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158622155003/assets.json?asset[key]=assets/v14-complete.js', { headers });
  const demoData = await demoBackup.json();
  if (demoData.asset && demoData.asset.value) {
    fs.writeFileSync('_rollback-demo-v14.js', demoData.asset.value);
    console.log('Rollback backup saved: _rollback-demo-v14.js (' + demoData.asset.value.length + ' bytes)');
  }

  const liveBackup = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js', { headers });
  const liveData = await liveBackup.json();
  if (liveData.asset && liveData.asset.value) {
    fs.writeFileSync('_rollback-live-v14.js', liveData.asset.value);
    console.log('Rollback backup saved: _rollback-live-v14.js (' + liveData.asset.value.length + ' bytes)');
  }

  // Upload new code to DEMO only
  const code = fs.readFileSync('live-v14-complete.js', 'utf8');
  console.log('Uploading to DEMO theme | Size: ' + code.length + ' bytes');
  const res = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158622155003/assets.json', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('Upload errors:', JSON.stringify(data.errors));
  } else {
    console.log('Uploaded to DEMO:', data.asset.key, '| updated_at:', data.asset.updated_at);
  }

  await p.$disconnect();
})();
