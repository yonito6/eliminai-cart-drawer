const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopName: true, shopDomain: true, currency: true, config: true },
  });
  console.log('Store found:', store ? store.shopDomain : 'NOT FOUND');
  console.log('Store ID:', store?.id);
  console.log('Store name:', store?.shopName);

  const cfg = store?.config || {};
  const addons = cfg.addons || {};
  console.log('\nAddons:');
  Object.keys(addons).forEach(k => {
    const a = addons[k];
    console.log(' ', k, '- enabled:', a.enabled, a.handle ? '| handle: ' + a.handle : '', a.variantId ? '| vid: ' + a.variantId : '');
    if (a.tiers) console.log('    tiers:', JSON.stringify(a.tiers).substring(0, 200));
    if (a.badges) console.log('    badges:', JSON.stringify(a.badges).substring(0, 200));
    if (a.milestones) console.log('    milestones:', JSON.stringify(a.milestones).substring(0, 200));
  });

  console.log('\nVisual:', JSON.stringify(cfg.visual || {}));

  // Also check what the addons API returns (with fallback logic)
  console.log('\n--- Eleganto store for comparison ---');
  const eStore = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopName: true, config: true },
  });
  const eCfg = eStore?.config || {};
  const eAddons = eCfg.addons || {};
  console.log('Eleganto ID:', eStore?.id);
  Object.keys(eAddons).forEach(k => {
    const a = eAddons[k];
    console.log(' ', k, '- enabled:', a.enabled);
  });

  await p.$disconnect();
})();
