const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const live = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true } });
  const test = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { accessToken: true } });

  async function readAsset(domain, token, themeId, assetKey) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.asset ? data.asset.value : null;
  }

  // Check if Impulse theme has its own drawer in the header section
  const liveHeader = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'sections/header.liquid');
  if (liveHeader) {
    fs.writeFileSync('/tmp/live-header.liquid', liveHeader);
    console.log('LIVE header.liquid length:', liveHeader.length);
    // Search for cart/drawer references
    const lines = liveHeader.split('\n');
    lines.forEach((l, i) => {
      if (l.match(/cart|drawer|CartDrawer/i)) {
        console.log(`  Line ${i+1}: ${l.trim().substring(0, 120)}`);
      }
    });
  }

  // Check where CCD_CONFIG or CFG is set in v14-complete.js (first 200 lines)
  const v14 = await readAsset('eleganto-3011.myshopify.com', live.accessToken, '158577557755', 'assets/v14-complete.js');
  if (v14) {
    // Find CFG initialization
    const cfgLines = v14.split('\n');
    console.log('\n=== v14-complete.js: CFG/CCD_CONFIG references (first 100 lines) ===');
    for (let i = 0; i < Math.min(cfgLines.length, 100); i++) {
      if (cfgLines[i].match(/CFG|CCD_CONFIG|window\.|var\s+[A-Z]/)) {
        console.log(`  Line ${i+1}: ${cfgLines[i].trim().substring(0, 150)}`);
      }
    }

    // Search for where it creates CartDrawer element or injects HTML
    console.log('\n=== v14-complete.js: CartDrawer element creation ===');
    for (let i = 0; i < cfgLines.length; i++) {
      if (cfgLines[i].match(/createElement.*CartDrawer|getElementById.*CartDrawer|querySelector.*CartDrawer|innerHTML.*CartDrawer|\.id\s*=.*CartDrawer/i)) {
        console.log(`  Line ${i+1}: ${cfgLines[i].trim().substring(0, 150)}`);
      }
    }

    // Where does CCD.refresh create HTML?
    console.log('\n=== v14-complete.js: CCD.refresh HTML building ===');
    for (let i = 0; i < cfgLines.length; i++) {
      if (cfgLines[i].match(/CCD\.refresh\s*=|function\s+refresh/)) {
        console.log(`  Line ${i+1}: ${cfgLines[i].trim().substring(0, 150)}`);
        // Show next 5 lines
        for (let j = 1; j <= 5; j++) {
          if (i+j < cfgLines.length) console.log(`  Line ${i+1+j}: ${cfgLines[i+j].trim().substring(0, 150)}`);
        }
      }
    }
  }

  // Check DEMO theme: where does v14-complete.js get loaded?
  const demoTheme = await readAsset('eliminai-test.myshopify.com', test.accessToken, '185993036089', 'layout/theme.liquid');
  console.log('\n=== DEMO theme.liquid: v14 loading location ===');
  demoTheme.split('\n').forEach((l, i) => {
    if (l.includes('v14')) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Check DEMO: where is cart-drawer rendered?
  console.log('\n=== DEMO theme.liquid: cart-drawer render location ===');
  demoTheme.split('\n').forEach((l, i) => {
    if (l.includes('cart-drawer') || l.includes('cart_drawer')) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  await p.$disconnect();
})();
