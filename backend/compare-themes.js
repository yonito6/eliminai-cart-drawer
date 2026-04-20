const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const test = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const live = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });

  const demoRes = await fetch('https://eliminai-test.myshopify.com/admin/api/2025-01/themes/185993036089/assets.json', {
    headers: { 'X-Shopify-Access-Token': test.accessToken }
  });
  const demoData = await demoRes.json();
  const demoAssets = demoData.assets.map(a => a.key).filter(k => k.match(/cart|ccd|eliminai|v14|drawer/i)).sort();

  const liveRes = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes/158577557755/assets.json', {
    headers: { 'X-Shopify-Access-Token': live.accessToken }
  });
  const liveData = await liveRes.json();
  const liveAssets = liveData.assets.map(a => a.key).filter(k => k.match(/cart|ccd|eliminai|v14|drawer/i)).sort();

  console.log('=== DEMO THEME (eliminai-test) cart/ccd/drawer assets ===');
  demoAssets.forEach(a => console.log('  ' + a));
  console.log('\n=== LIVE THEME (eleganto-3011) cart/ccd/drawer assets ===');
  liveAssets.forEach(a => console.log('  ' + a));

  const onlyDemo = demoAssets.filter(a => !liveAssets.includes(a));
  const onlyLive = liveAssets.filter(a => !demoAssets.includes(a));
  console.log('\n=== ONLY ON DEMO ===');
  onlyDemo.forEach(a => console.log('  ' + a));
  console.log('\n=== ONLY ON LIVE ===');
  onlyLive.forEach(a => console.log('  ' + a));
  console.log('\n=== ON BOTH (may differ in content) ===');
  const onBoth = demoAssets.filter(a => liveAssets.includes(a));
  onBoth.forEach(a => console.log('  ' + a));

  await p.$disconnect();
})();
