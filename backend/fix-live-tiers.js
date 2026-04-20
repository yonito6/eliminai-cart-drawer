const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ 
    where: { shopDomain: { contains: 'eleganto-3011' } }, 
    select: { id: true, config: true, demoConfig: true } 
  });
  if (!store) { console.log('No store'); return; }

  const liveCfg = store.config || {};
  const demoCfg = store.demoConfig || {};
  
  const liveAddons = liveCfg.addons || {};
  const demoAddons = demoCfg.addons || {};
  
  const liveTiers = liveAddons.freeShippingBar?.config?.tiers || [];
  const demoTiers = demoAddons.freeShippingBar?.config?.tiers || [];
  
  console.log('Live tiers:', liveTiers.length);
  console.log('Demo tiers:', demoTiers.length);
  
  // Copy demo tiers to live config
  if (!liveAddons.freeShippingBar) liveAddons.freeShippingBar = {};
  if (!liveAddons.freeShippingBar.config) liveAddons.freeShippingBar.config = {};
  liveAddons.freeShippingBar.config.tiers = demoTiers;
  liveCfg.addons = liveAddons;
  
  // Also clean up stale giftDiscountCodes
  delete liveCfg.giftDiscountCodes;
  delete demoCfg.giftDiscountCodes;
  
  await p.store.update({ where: { id: store.id }, data: { config: liveCfg, demoConfig: demoCfg } });
  
  console.log('Updated live config with demo tiers (' + demoTiers.length + ' tiers)');
  console.log('Cleaned stale giftDiscountCodes');
  
  // Verify
  const updated = await p.store.findUnique({ where: { id: store.id }, select: { config: true } });
  const newTiers = updated.config?.addons?.freeShippingBar?.config?.tiers || [];
  for (const t of newTiers) {
    const gifts = t.giftProducts || [];
    console.log(`  Tier goal=${t.goal}: ${gifts.length} gifts [${gifts.map(g => g.handle).join(', ')}]`);
  }
  
  await p.$disconnect();
})();
