const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const v14Res = await fetch(`https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await v14Res.json();
  fs.writeFileSync('C:/Projects/eliminai-cart-drawer/v14-live-current.js', data.asset.value);
  console.log('Saved to v14-live-current.js, size:', data.asset.value.length);
  await p.$disconnect();
})();
