const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 158622155003; // DEMO theme
  
  // Check theme.liquid for v14 references
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=layout/theme.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  if (data.asset) {
    var lines = data.asset.value.split('\n');
    console.log('=== Production theme.liquid (v14/CCD/eliminai references) ===');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes('v14') || lines[i].includes('CCD') || lines[i].includes('ccd') || lines[i].includes('eliminai') || lines[i].includes('app-embed')) {
        console.log('  line ' + (i+1) + ': ' + lines[i].trim());
      }
    }
  }
  
  // Check for app embed sections
  var secRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var secData = await secRes.json();
  var appBlocks = secData.assets.filter(function(a) {
    return a.key.includes('blocks/') || (a.key.includes('app') && a.key.includes('embed'));
  });
  if (appBlocks.length > 0) {
    console.log('\nApp blocks/embeds:');
    appBlocks.forEach(function(a) { console.log('  ' + a.key); });
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
