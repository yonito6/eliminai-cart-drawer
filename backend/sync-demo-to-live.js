const { PrismaClient } = require('@prisma/client');
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

  async function writeAsset(themeId, assetKey, value) {
    const res = await fetch(`https://${DOMAIN}/admin/api/2025-01/themes/${themeId}/assets.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: { key: assetKey, value } })
    });
    const data = await res.json();
    return data;
  }

  // Read both files from DEMO
  console.log('Reading DEMO v14-complete.js...');
  const demoV14 = await readAsset(DEMO_THEME, 'assets/v14-complete.js');
  console.log('  Size:', demoV14.length, 'bytes');

  console.log('Reading DEMO custom-cart-drawer.css...');
  const demoCss = await readAsset(DEMO_THEME, 'assets/custom-cart-drawer.css');
  console.log('  Size:', demoCss.length, 'bytes');

  // Upload to LIVE
  console.log('\nUploading v14-complete.js to LIVE...');
  const v14Result = await writeAsset(LIVE_THEME, 'assets/v14-complete.js', demoV14);
  if (v14Result.errors) {
    console.error('ERROR:', JSON.stringify(v14Result.errors));
  } else {
    console.log('  OK:', v14Result.asset?.key, '| updated_at:', v14Result.asset?.updated_at);
  }

  console.log('Uploading custom-cart-drawer.css to LIVE...');
  const cssResult = await writeAsset(LIVE_THEME, 'assets/custom-cart-drawer.css', demoCss);
  if (cssResult.errors) {
    console.error('ERROR:', JSON.stringify(cssResult.errors));
  } else {
    console.log('  OK:', cssResult.asset?.key, '| updated_at:', cssResult.asset?.updated_at);
  }

  // Verify
  console.log('\nVerifying...');
  const liveV14 = await readAsset(LIVE_THEME, 'assets/v14-complete.js');
  const liveCss = await readAsset(LIVE_THEME, 'assets/custom-cart-drawer.css');
  console.log('v14-complete.js match:', liveV14 === demoV14 ? 'YES' : 'NO');
  console.log('custom-cart-drawer.css match:', liveCss === demoCss ? 'YES' : 'NO');

  await p.$disconnect();
})();
