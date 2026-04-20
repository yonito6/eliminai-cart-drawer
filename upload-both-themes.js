const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const code = fs.readFileSync('v14-complete.js', 'utf8');
  console.log('File size:', code.length, 'bytes');

  const LIVE_THEME = '145950245115';
  const DEMO_THEME = '158622155003';

  async function uploadToTheme(themeId, label) {
    const assetData = JSON.stringify({
      asset: { key: 'assets/v14-complete.js', value: code }
    });

    const res = await fetch(
      `https://${store.shopDomain}/admin/api/2025-01/themes/${themeId}/assets.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json',
        },
        body: assetData,
      }
    );

    const data = await res.json();
    if (data.asset) {
      console.log(`${label} (${themeId}): uploaded OK — ${data.asset.key} size=${data.asset.size}`);
    } else {
      console.error(`${label} (${themeId}): ERROR —`, JSON.stringify(data));
    }
  }

  await uploadToTheme(LIVE_THEME, 'LIVE');
  await uploadToTheme(DEMO_THEME, 'DEMO');

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
