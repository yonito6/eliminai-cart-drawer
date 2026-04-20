const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 158622155003;
  
  // Get eliminai-cart-embed snippet
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=snippets/eliminai-cart-embed.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  if (data.asset) {
    console.log('=== snippets/eliminai-cart-embed.liquid ===');
    console.log(data.asset.value);
  }
  
  // Also get the ccd-theme-hide style from theme.liquid head
  var res2 = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=layout/theme.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data2 = await res2.json();
  if (data2.asset) {
    var lines = data2.asset.value.split('\n');
    console.log('\n=== ccd-theme-hide style in theme.liquid ===');
    for (var i = 2; i < Math.min(30, lines.length); i++) {
      if (lines[i].includes('ccd-theme-hide') || lines[i].includes('CartDrawer') || lines[i].includes('cart-drawer') || lines[i].includes('</style>')) {
        console.log('  line ' + (i+1) + ': ' + lines[i]);
      }
      if (i > 3 && lines[i].includes('</style>')) break;
    }
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
