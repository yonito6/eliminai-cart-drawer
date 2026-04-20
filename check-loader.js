const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const LIVE = 145950245115;

  // List all assets and find ones that might reference v14-complete
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + LIVE + '/assets.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();

  // Check snippets and sections for v14-complete references
  const candidates = data.assets.filter(a =>
    a.key.startsWith('snippets/') || a.key.startsWith('sections/') || a.key.startsWith('layout/')
  ).filter(a => a.key.endsWith('.liquid'));

  console.log('Checking', candidates.length, 'liquid files for v14-complete reference...\n');

  for (const asset of candidates) {
    const assetRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + LIVE + '/assets.json?asset[key]=' + encodeURIComponent(asset.key), {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });
    const assetData = await assetRes.json();
    if (assetData.asset && assetData.asset.value && assetData.asset.value.includes('v14-complete')) {
      console.log('FOUND in: ' + asset.key);
      // Show surrounding lines
      const lines = assetData.asset.value.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('v14-complete')) {
          console.log('  Line ' + (i+1) + ': ' + line.trim());
        }
      });
      console.log('');
    }
  }

  console.log('Done.');
  await p.$disconnect();
})();
