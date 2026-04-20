const fs = require('fs');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });

  const jsContent = fs.readFileSync('./v14-complete.js', 'utf8');
  console.log('File size:', jsContent.length);

  const themes = [
    [158577557755, 'LIVE'],
    [158622155003, 'DEMO'],
  ];

  for (const [id, label] of themes) {
    const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/${id}/assets.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: jsContent } }),
    });
    console.log(label + ':', res.ok ? 'SUCCESS' : 'FAILED ' + res.status);
  }

  // Also upload to eliminai-test DEMO theme
  const testStore = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });
  if (testStore) {
    const res = await fetch(`https://${testStore.shopDomain}/admin/api/2025-01/themes/185992970553/assets.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': testStore.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: jsContent } }),
    });
    console.log('TEST STORE DEMO:', res.ok ? 'SUCCESS' : 'FAILED ' + res.status);
  }

  await p.$disconnect();
})();
