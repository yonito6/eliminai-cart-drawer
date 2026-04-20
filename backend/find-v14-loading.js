const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const test = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { accessToken: true } });
  const live = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });

  async function readAsset(domain, token, themeId, assetKey) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.asset ? data.asset.value : null;
  }

  async function listAssets(domain, token, themeId) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${themeId}/assets.json`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.assets.map(a => a.key);
  }

  // Get all liquid files from DEMO theme and search for v14
  const demoAssets = await listAssets('eliminai-test.myshopify.com', test.accessToken, '185993036089');
  const liquidAssets = demoAssets.filter(a => a.endsWith('.liquid'));

  console.log('Searching', liquidAssets.length, 'liquid files on DEMO for v14...');
  for (const asset of liquidAssets) {
    const content = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', asset);
    if (content && content.includes('v14')) {
      console.log('FOUND v14 in:', asset);
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (l.includes('v14')) console.log(`  Line ${i+1}: ${l.trim()}`);
      });
    }
  }

  // Also search for CCD_CONFIG in DEMO
  console.log('\nSearching DEMO for CCD_CONFIG...');
  for (const asset of liquidAssets) {
    const content = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', asset);
    if (content && content.includes('CCD_CONFIG')) {
      console.log('FOUND CCD_CONFIG in:', asset);
    }
  }

  // Now check LIVE: where is the cart icon that opens the drawer?
  const liveHeader = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'sections/header.liquid');
  console.log('\n=== LIVE header.liquid: drawer-open references ===');
  liveHeader.split('\n').forEach((l, i) => {
    if (l.match(/drawer-open|js-drawer|cart-link|cart-count|cart_icon/i)) {
      console.log(`  Line ${i+1}: ${l.trim().substring(0, 150)}`);
    }
  });

  await p.$disconnect();
})();
