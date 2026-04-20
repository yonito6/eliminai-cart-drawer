const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  // Check DEMO theme.liquid
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/158622155003/assets.json?asset[key]=layout/theme.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();
  if (data.asset && data.asset.value) {
    const lines = data.asset.value.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('v14-complete') || line.includes('custom-cart-drawer') || line.includes('CCD') || line.includes('cart_drawer')) {
        console.log('Line ' + (i+1) + ': ' + line.trim());
      }
    });
  }

  // Also check LIVE theme
  const res2 = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/145950245115/assets.json?asset[key]=layout/theme.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data2 = await res2.json();
  if (data2.asset && data2.asset.value) {
    console.log('\nLIVE theme:');
    const lines2 = data2.asset.value.split('\n');
    lines2.forEach((line, i) => {
      if (line.includes('v14-complete') || line.includes('custom-cart-drawer') || line.includes('CCD') || line.includes('cart_drawer')) {
        console.log('Line ' + (i+1) + ': ' + line.trim());
      }
    });
  }

  await p.$disconnect();
})();
