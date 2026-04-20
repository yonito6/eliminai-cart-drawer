const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const test = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const live = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });

  async function readAsset(domain, token, themeId, assetKey) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.asset ? data.asset.value : null;
  }

  // Read cart-drawer.liquid from both
  const demoSnippet = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', 'snippets/cart-drawer.liquid');
  const liveSnippet = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'snippets/cart-drawer.liquid');

  fs.writeFileSync('/tmp/demo-cart-drawer.liquid', demoSnippet || 'NOT FOUND');
  fs.writeFileSync('/tmp/live-cart-drawer.liquid', liveSnippet || 'NOT FOUND');

  console.log('DEMO snippet length:', demoSnippet ? demoSnippet.length : 0);
  console.log('LIVE snippet length:', liveSnippet ? liveSnippet.length : 0);

  // Also read the LIVE custom-cart-drawer.js (may be the old cart drawer code)
  const liveCustomJs = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'assets/custom-cart-drawer.js');
  if (liveCustomJs) {
    fs.writeFileSync('/tmp/live-custom-cart-drawer.js', liveCustomJs);
    console.log('LIVE custom-cart-drawer.js length:', liveCustomJs.length);
  }

  // Read LIVE eliminai-cart.js
  const liveEliminaiJs = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'assets/eliminai-cart.js');
  if (liveEliminaiJs) {
    fs.writeFileSync('/tmp/live-eliminai-cart.js', liveEliminaiJs);
    console.log('LIVE eliminai-cart.js length:', liveEliminaiJs.length);
  }

  // Read LIVE custom-cart-drawer.css
  const liveCss = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'assets/custom-cart-drawer.css');
  if (liveCss) {
    fs.writeFileSync('/tmp/live-custom-cart-drawer.css', liveCss);
    console.log('LIVE custom-cart-drawer.css length:', liveCss.length);
  }

  // Read LIVE cart-item.liquid
  const liveCartItem = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'snippets/cart-item.liquid');
  if (liveCartItem) {
    fs.writeFileSync('/tmp/live-cart-item.liquid', liveCartItem);
    console.log('LIVE cart-item.liquid length:', liveCartItem.length);
  }

  // Check where v14-complete.js is loaded on LIVE — search theme.liquid or layout/theme.liquid
  const liveTheme = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'layout/theme.liquid');
  if (liveTheme) {
    const v14Lines = liveTheme.split('\n').filter(l => l.includes('v14') || l.includes('eliminai-cart') || l.includes('custom-cart-drawer'));
    console.log('\nLIVE theme.liquid references:');
    v14Lines.forEach(l => console.log('  ' + l.trim()));
  }

  // Same for DEMO
  const demoTheme = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', 'layout/theme.liquid');
  if (demoTheme) {
    const v14Lines = demoTheme.split('\n').filter(l => l.includes('v14') || l.includes('eliminai-cart') || l.includes('custom-cart-drawer') || l.includes('cart-drawer'));
    console.log('\nDEMO theme.liquid references:');
    v14Lines.forEach(l => console.log('  ' + l.trim()));
  }

  await p.$disconnect();
})();
