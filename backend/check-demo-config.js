const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const prodStore = await p.store.findFirst({ where: { shopDomain: { contains: 'eleganto-3011' } }, select: { demoConfig: true } });
  if (prodStore) {
    const cfg = prodStore.demoConfig || {};
    const addons = cfg.addons || {};
    const bar = addons.freeShippingBar?.config || {};
    const tiers = bar.tiers || [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      console.log(`Tier ${i+1}: goal=${t.goal}, label=${t.label}`);
      console.log('  giftProducts:', JSON.stringify((t.giftProducts || []).map(g => ({ handle: g.handle, title: g.title }))));
    }
  }
  await p.$disconnect();
})();
