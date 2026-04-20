const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }
  console.log('Store:', store.shopDomain);
  console.log('Token:', store.accessToken ? store.accessToken.substring(0, 10) + '...' : 'NONE');

  // List themes
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();
  console.log('Themes:');
  for (const t of data.themes) {
    console.log('  ' + t.id + ' | ' + t.name + ' | ' + t.role);
  }
  await p.$disconnect();
})();
