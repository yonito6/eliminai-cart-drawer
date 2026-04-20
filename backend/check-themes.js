const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true, demoThemeId: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;
  console.log('demoThemeId in DB:', store.demoThemeId);

  const res = await fetch(`https://${domain}/admin/api/2025-01/themes.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  data.themes.forEach(t => {
    console.log('Theme:', t.id, '| role:', t.role, '| name:', t.name);
  });

  // Check if live theme has v14-complete.js
  const liveTheme = data.themes.find(t => t.role === 'main');
  if (liveTheme) {
    const assetRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${liveTheme.id}/assets.json?asset[key]=assets/v14-complete.js&fields=key,updated_at`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    if (assetRes.ok) {
      const assetData = await assetRes.json();
      console.log('\nLIVE theme v14-complete.js:', JSON.stringify(assetData.asset, null, 2));
    } else {
      console.log('\nLIVE theme has NO v14-complete.js');
    }

    // Check staging theme too
    const stageRes = await fetch(`https://${domain}/admin/api/2025-01/themes/158622155003/assets.json?asset[key]=assets/v14-complete.js&fields=key,updated_at`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    if (stageRes.ok) {
      const stageData = await stageRes.json();
      console.log('STAGING theme v14-complete.js:', JSON.stringify(stageData.asset, null, 2));
    }
  }

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
