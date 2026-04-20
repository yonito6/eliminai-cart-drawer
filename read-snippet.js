const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 185993036089;
  
  // Read the v14-drawer.liquid snippet
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=snippets/v14-drawer.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  if (data.asset) {
    console.log('=== snippets/v14-drawer.liquid ===');
    console.log(data.asset.value);
  } else {
    console.log('NOT FOUND:', JSON.stringify(data));
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
