const fs = require('fs');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }

  const LIVE_THEME_ID = 158577557755; // "Eliminai Cart Drawer Live" (main)

  const jsContent = fs.readFileSync('./v14-complete.js', 'utf8');
  console.log('Uploading v14-complete.js to LIVE theme (' + LIVE_THEME_ID + ')...');
  console.log('File size:', jsContent.length, 'bytes');

  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/${LIVE_THEME_ID}/assets.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asset: { key: 'assets/v14-complete.js', value: jsContent },
    }),
  });

  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
  } else {
    console.log('SUCCESS — Live theme updated');
  }

  await p.$disconnect();
})();
