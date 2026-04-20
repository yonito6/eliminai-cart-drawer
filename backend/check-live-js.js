const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Get v14-complete.js from LIVE theme (158577557755)
  const res = await fetch(`https://${domain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  const code = data.asset.value;

  // Check key indicators
  console.log('File length:', code.length);
  console.log('Has _mergeTiersFromConfig:', code.includes('_mergeTiersFromConfig'));
  console.log('Has getAdjustedTotal:', code.includes('getAdjustedTotal'));
  console.log('Has getGiftSavings:', code.includes('getGiftSavings'));
  console.log('Has GIFT_HANDLES:', code.includes('GIFT_HANDLES'));
  console.log('Has _giftAddFails:', code.includes('_giftAddFails'));
  console.log('Has CCD GIFT debug:', code.includes('[CCD GIFT]'));
  console.log('Has CCD DEBUG:', code.includes('[CCD DEBUG]'));

  // Check what getAdjustedTotal does
  const adjIdx = code.indexOf('getAdjustedTotal');
  if (adjIdx > -1) {
    console.log('\ngetAdjustedTotal context (200 chars):', code.substring(adjIdx, adjIdx + 500));
  }

  // Check how total_price is displayed
  const totalMatches = code.match(/total_price/g);
  console.log('\ntotal_price occurrences:', totalMatches ? totalMatches.length : 0);

  // Check if cart.total_price is used directly anywhere (not wrapped in getAdjustedTotal)
  const directTotal = code.match(/cart\.total_price[^)]/g);
  console.log('Direct cart.total_price usage:', directTotal ? directTotal.length : 0, directTotal);

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
