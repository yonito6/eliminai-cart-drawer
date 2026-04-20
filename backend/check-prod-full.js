const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const prodStore = await p.store.findFirst({ where: { shopDomain: { contains: 'eleganto-3011' } }, select: { config: true } });
  if (prodStore) {
    const cfg = prodStore.config || {};
    const addons = cfg.addons || {};
    const bar = addons.freeShippingBar?.config || {};
    const tiers = bar.tiers || [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      console.log(`\nTier ${i+1}: goal=${t.goal}, label=${t.label}`);
      console.log('  giftProduct:', t.giftProduct ? t.giftProduct.handle : 'null');
      console.log('  giftProducts:', JSON.stringify((t.giftProducts || []).map(g => ({ handle: g.handle, title: g.title }))));
    }
    console.log('\ngiftDiscountCodes:', cfg.giftDiscountCodes);
  }
  await p.$disconnect();
})();
