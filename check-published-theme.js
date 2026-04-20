const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  // List all themes
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();

  for (const theme of data.themes) {
    console.log(`ID: ${theme.id} | Name: ${theme.name} | Role: ${theme.role}`);

    // Check if theme has v14-complete.js
    try {
      const assetRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + theme.id + '/assets.json?asset[key]=assets/v14-complete.js', {
        headers: { 'X-Shopify-Access-Token': store.accessToken }
      });
      const assetData = await assetRes.json();
      if (assetData.asset) {
        console.log(`  → Has v14-complete.js (${assetData.asset.size} bytes, updated: ${assetData.asset.updated_at})`);
      } else {
        console.log(`  → NO v14-complete.js`);
      }
    } catch (e) {
      console.log(`  → Error checking asset: ${e.message}`);
    }
  }

  await p.$disconnect();
})();
