const fs = require('fs');
const code = fs.readFileSync('C:/Projects/eliminai-cart-drawer/v14-complete.js', 'utf8');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');

async function main() {
  const p = new PrismaClient();
  const store = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' } });
  if (!store || !store.accessToken) {
    console.log('Store not found');
    await p.$disconnect();
    return;
  }

  const themeId = '185992970553'; // DEMO theme
  const assetKey = 'assets/v14-complete.js';

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ asset: { key: assetKey, value: code } }),
  });

  const data = await res.json();
  if (data.asset) {
    console.log('Uploaded to eliminai-test DEMO theme: ' + assetKey + ' (' + (code.length / 1024).toFixed(0) + ' KB)');
  } else {
    console.log('Upload failed:', JSON.stringify(data));
  }

  await p.$disconnect();
}
main();
