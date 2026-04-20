const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();
  const js = data.asset.value;
  console.log('=== LIVE THEME JS VERIFICATION ===');
  console.log('Size:', js.length, 'bytes');
  console.log('Updated:', data.asset.updated_at);
  console.log('');
  console.log('Gift fix (form-encoded):');
  console.log('  Has _addOneGift helper:', js.includes('_addOneGift'));
  console.log('  Old JSON items gift (should be false):', js.includes('JSON.stringify({ items: toAdd })'));
  console.log('');
  console.log('Protection (should be unchanged):');
  const protJsonAdd = (js.match(/JSON\.stringify\(\{ items: \[\{ id: PROT_VID/g) || []).length;
  console.log('  Protection JSON add calls:', protJsonAdd);
  console.log('  Has ensureProtection:', js.includes('ensureProtection'));
  console.log('  Has protectionDone flag:', js.includes('protectionDone'));
  console.log('  Toggle handler present:', js.includes('ccd-shipping-toggle'));
  console.log('');
  console.log('Discount row (Eliminai Gift should be hidden):');
  console.log('  Has rebuildDiscountRow:', js.includes('rebuildDiscountRow'));
  console.log('');
  // Show first 200 chars around _addOneGift
  const idx = js.indexOf('_addOneGift');
  if (idx > -1) {
    console.log('_addOneGift snippet:', js.substring(idx, idx + 150));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
