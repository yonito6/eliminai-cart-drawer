const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const live = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const test = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { accessToken: true } });

  // List ALL themes on LIVE store
  const liveRes = await fetch('https://eleganto-3011.myshopify.com/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': live.accessToken }
  });
  const liveData = await liveRes.json();
  console.log('=== ALL THEMES on eleganto-3011 (LIVE store) ===');
  liveData.themes.forEach(t => {
    console.log(`  ${t.id} | ${t.name} | role: ${t.role} | ${t.theme_store_concept_id || 'custom'}`);
  });

  // List ALL themes on TEST store
  const testRes = await fetch('https://eliminai-test.myshopify.com/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': test.accessToken }
  });
  const testData = await testRes.json();
  console.log('\n=== ALL THEMES on eliminai-test (TEST store) ===');
  testData.themes.forEach(t => {
    console.log(`  ${t.id} | ${t.name} | role: ${t.role} | ${t.theme_store_concept_id || 'custom'}`);
  });

  await p.$disconnect();
})();
