const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });

  // Check how v14-complete.js is loaded in the live theme
  const LIVE_THEME = 158577557755;
  const DEMO_THEME = 158622155003;

  for (const [label, themeId] of [['LIVE', LIVE_THEME], ['DEMO', DEMO_THEME]]) {
    // Get theme.liquid to find how JS is loaded
    const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=layout/theme.liquid`, {
      headers: { 'X-Shopify-Access-Token': store.accessToken },
    });
    const data = await res.json();
    const content = data.asset?.value || '';
    // Find lines with v14
    const lines = content.split('\n');
    const v14Lines = lines.filter(l => l.includes('v14'));
    console.log(`\n=== ${label} theme (${themeId}) ===`);
    v14Lines.forEach(l => console.log('  ' + l.trim()));
  }

  await p.$disconnect();
})();
