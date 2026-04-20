const fs = require('fs');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

const DEMO_THEME_ID = 185992970553;

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }

  const jsContent = fs.readFileSync('./v14-complete.js', 'utf8');
  console.log('JS file size:', jsContent.length, 'bytes');

  // Upload as theme asset
  const url = `https://${store.shopDomain}/admin/api/2025-01/themes/${DEMO_THEME_ID}/assets.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asset: {
        key: 'assets/v14-complete.js',
        value: jsContent,
      },
    }),
  });

  if (!res.ok) {
    console.error('Upload failed:', res.status, await res.text());
  } else {
    const data = await res.json();
    console.log('Uploaded successfully!');
    console.log('Asset key:', data.asset.key);
    console.log('Theme:', DEMO_THEME_ID, '(Horizon - DEMO)');
  }

  await p.$disconnect();
})();
