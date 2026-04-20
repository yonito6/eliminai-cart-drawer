const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 185993036089;
  
  // Check how v14-complete.js is loaded — check theme.liquid
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=layout/theme.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  if (data.asset) {
    var content = data.asset.value;
    // Search for v14 references
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes('v14') || lines[i].includes('ccd') || lines[i].includes('eliminai') || lines[i].includes('cart-drawer')) {
        console.log('theme.liquid line ' + (i+1) + ': ' + lines[i].trim());
      }
    }
    // Also check if v14-drawer snippet is rendered
    if (content.includes('v14-drawer')) {
      console.log('\n✓ theme.liquid renders v14-drawer snippet');
    } else {
      console.log('\n✗ theme.liquid does NOT render v14-drawer snippet!');
    }
  }
  
  // Check if there's an app embed block
  console.log('\n--- Checking for app blocks / sections ---');
  var secRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var secData = await secRes.json();
  var appBlocks = secData.assets.filter(function(a) {
    return a.key.includes('blocks/') && (a.key.includes('eliminai') || a.key.includes('ccd') || a.key.includes('cart'));
  });
  console.log('App blocks:', appBlocks.length > 0 ? appBlocks.map(function(a) { return a.key; }).join(', ') : 'NONE');
  
  // Check sections/cart-drawer.liquid for our code
  var cartRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=sections/cart-drawer.liquid', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var cartData = await cartRes.json();
  if (cartData.asset) {
    var cartContent = cartData.asset.value;
    if (cartContent.includes('v14')) {
      console.log('\n✓ sections/cart-drawer.liquid references v14');
    }
    if (cartContent.includes('CCD')) {
      console.log('✓ sections/cart-drawer.liquid references CCD');
    }
    // Show last 20 lines or lines with v14/CCD
    var cartLines = cartContent.split('\n');
    console.log('\nRelevant lines from sections/cart-drawer.liquid:');
    for (var i = 0; i < cartLines.length; i++) {
      if (cartLines[i].includes('v14') || cartLines[i].includes('CCD') || cartLines[i].includes('ccd') || cartLines[i].includes('eliminai')) {
        console.log('  line ' + (i+1) + ': ' + cartLines[i].trim());
      }
    }
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
