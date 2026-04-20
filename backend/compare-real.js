const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const LIVE_THEME = '158577557755';
const DEMO_THEME = '158622155003';
const DOMAIN = 'eleganto-3011.myshopify.com';

(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: DOMAIN }, select: { accessToken: true } });
  const token = store.accessToken;

  async function readAsset(themeId, assetKey) {
    const res = await fetch(`https://${DOMAIN}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.asset ? data.asset.value : null;
  }

  async function listAssets(themeId) {
    const res = await fetch(`https://${DOMAIN}/admin/api/2025-01/themes/${themeId}/assets.json`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const data = await res.json();
    return data.assets.map(a => a.key);
  }

  // List cart/drawer/ccd assets on DEMO theme
  const demoAssets = await listAssets(DEMO_THEME);
  const demoCart = demoAssets.filter(k => k.match(/cart|ccd|eliminai|v14|drawer/i)).sort();

  const liveAssets = await listAssets(LIVE_THEME);
  const liveCart = liveAssets.filter(k => k.match(/cart|ccd|eliminai|v14|drawer/i)).sort();

  console.log('=== DEMO theme (158622155003) cart assets ===');
  demoCart.forEach(a => console.log('  ' + a));
  console.log('\n=== LIVE theme (158577557755) cart assets ===');
  liveCart.forEach(a => console.log('  ' + a));

  const onlyDemo = demoCart.filter(a => !liveCart.includes(a));
  const onlyLive = liveCart.filter(a => !demoCart.includes(a));
  console.log('\n=== ONLY ON DEMO ===');
  onlyDemo.forEach(a => console.log('  ' + a));
  console.log('\n=== ONLY ON LIVE ===');
  onlyLive.forEach(a => console.log('  ' + a));

  // Read and compare key files
  const filesToCompare = [
    'snippets/cart-drawer.liquid',
    'snippets/cart-item.liquid',
    'layout/theme.liquid',
    'sections/header.liquid',
    'assets/custom-cart-drawer.css'
  ];

  for (const file of filesToCompare) {
    const demo = await readAsset(DEMO_THEME, file);
    const live = await readAsset(LIVE_THEME, file);

    if (!demo && !live) continue;

    const demoLen = demo ? demo.length : 0;
    const liveLen = live ? live.length : 0;
    const same = demo === live;

    console.log(`\n${file}: DEMO=${demoLen} LIVE=${liveLen} ${same ? 'IDENTICAL' : 'DIFFERENT'}`);

    if (!same && demo && live) {
      // Save both for diff
      fs.writeFileSync(`/tmp/demo-${file.replace(/\//g, '-')}`, demo);
      fs.writeFileSync(`/tmp/live-${file.replace(/\//g, '-')}`, live);
    }
  }

  // Check v14-complete.js on DEMO theme
  const demoV14 = await readAsset(DEMO_THEME, 'assets/v14-complete.js');
  const liveV14 = await readAsset(LIVE_THEME, 'assets/v14-complete.js');
  console.log(`\nassets/v14-complete.js: DEMO=${demoV14 ? demoV14.length : 0} LIVE=${liveV14 ? liveV14.length : 0} ${demoV14 === liveV14 ? 'IDENTICAL' : 'DIFFERENT'}`);

  // Check where v14 is loaded on DEMO theme
  const demoTheme = await readAsset(DEMO_THEME, 'layout/theme.liquid');
  console.log('\n=== DEMO theme.liquid: v14/ccd references ===');
  demoTheme.split('\n').forEach((l, i) => {
    if (l.match(/v14|ccd|cart-drawer|custom-cart/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Check where v14 is loaded on LIVE theme
  const liveTheme = await readAsset(LIVE_THEME, 'layout/theme.liquid');
  console.log('\n=== LIVE theme.liquid: v14/ccd references ===');
  liveTheme.split('\n').forEach((l, i) => {
    if (l.match(/v14|ccd|cart-drawer|custom-cart/i)) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });

  // Read DEMO cart-drawer.liquid
  const demoSnippet = await readAsset(DEMO_THEME, 'snippets/cart-drawer.liquid');
  if (demoSnippet) {
    fs.writeFileSync('/tmp/demo-real-cart-drawer.liquid', demoSnippet);
    console.log('\nSaved DEMO cart-drawer.liquid to /tmp/demo-real-cart-drawer.liquid');
  }

  await p.$disconnect();
})();
