const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 185993036089;
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  
  console.log('All JS/liquid snippet assets:');
  data.assets.filter(function(a) {
    return a.key.endsWith('.js') || a.key.includes('snippet') || a.key.includes('v14') || a.key.includes('ccd') || a.key.includes('eliminai') || a.key.includes('cart');
  }).forEach(function(a) { console.log('  ' + a.key); });

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
