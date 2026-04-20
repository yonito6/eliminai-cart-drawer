const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
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

  // Read full theme.liquid from LIVE to find ALL script references
  const liveTheme = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'layout/theme.liquid');
  fs.writeFileSync('/tmp/live-theme.liquid', liveTheme || 'NOT FOUND');

  // Search for any reference to custom-cart-drawer.js or eliminai-cart.js in LIVE theme
  const liveLines = liveTheme.split('\n');
  console.log('=== LIVE theme.liquid script/css references ===');
  liveLines.forEach((l, i) => {
    if (l.match(/script|stylesheet|\.js|\.css/i) && l.match(/cart|ccd|eliminai|drawer|v14/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Check if custom-cart-drawer.js or eliminai-cart.js are loaded from the snippet
  const liveSnippet = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'snippets/cart-drawer.liquid');
  const snippetLines = liveSnippet.split('\n');
  console.log('\n=== LIVE cart-drawer.liquid script references ===');
  snippetLines.forEach((l, i) => {
    if (l.match(/script|\.js/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Check cart-item.liquid for any script references
  const liveCartItem = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'snippets/cart-item.liquid');
  console.log('\n=== LIVE cart-item.liquid script references ===');
  if (liveCartItem) {
    liveCartItem.split('\n').forEach((l, i) => {
      if (l.match(/script|\.js/i)) {
        console.log(`  Line ${i+1}: ${l.trim()}`);
      }
    });
  }

  // Read the DEMO theme.liquid to compare approach
  const demoTheme = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', 'layout/theme.liquid');
  fs.writeFileSync('/tmp/demo-theme.liquid', demoTheme || 'NOT FOUND');

  const demoLines = demoTheme.split('\n');
  console.log('\n=== DEMO theme.liquid script/css references ===');
  demoLines.forEach((l, i) => {
    if (l.match(/script|stylesheet|\.js|\.css/i) && l.match(/cart|ccd|eliminai|drawer|v14/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Also check: does the LIVE theme have ANY other place that renders cart-drawer?
  // Check for 'render' or 'include' of cart-drawer in theme.liquid
  console.log('\n=== LIVE theme.liquid cart-drawer render/include ===');
  liveLines.forEach((l, i) => {
    if (l.match(/render|include/i) && l.match(/cart|drawer/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  console.log('\n=== DEMO theme.liquid cart-drawer render/include ===');
  demoLines.forEach((l, i) => {
    if (l.match(/render|include/i) && l.match(/cart|drawer/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Where does LIVE theme render cart-drawer snippet?
  console.log('\n=== LIVE: searching ALL Liquid for cart-drawer snippet render ===');
  // Search in theme.liquid
  liveLines.forEach((l, i) => {
    if (l.includes('cart-drawer')) {
      console.log(`  theme.liquid:${i+1}: ${l.trim()}`);
    }
  });

  await p.$disconnect();
})();
