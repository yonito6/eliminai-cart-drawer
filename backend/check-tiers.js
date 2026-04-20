const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const testStore = await p.store.findFirst({ where: { shopDomain: { contains: 'eliminai-test' } }, select: { id: true, shopDomain: true, config: true } });
  if (testStore) {
    const cfg = testStore.config || {};
    const addons = cfg.addons || {};
    const bar = addons.freeShippingBar?.config || {};
    console.log('=== TEST STORE TIERS ===');
    console.log(JSON.stringify(bar.tiers, null, 2));
  }
  const prodStore = await p.store.findFirst({ where: { shopDomain: { contains: 'eleganto-3011' } }, select: { id: true, shopDomain: true, config: true } });
  if (prodStore) {
    const cfg = prodStore.config || {};
    const addons = cfg.addons || {};
    const bar = addons.freeShippingBar?.config || {};
    console.log('\n=== PROD STORE TIERS ===');
    console.log(JSON.stringify(bar.tiers, null, 2));
    console.log('\n=== PROD giftDiscountCodes ===');
    console.log(cfg.giftDiscountCodes);
  }
  await p.$disconnect();
})();
