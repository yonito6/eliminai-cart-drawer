const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' } });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }

  const cfg = store.config || {};
  const fsb = cfg.addons?.freeShippingBar?.config || {};

  console.log('=== freeShippingBar.config ===');
  console.log('giftCustomerChoice:', fsb.giftCustomerChoice);
  console.log('giftPickerTitle:', fsb.giftPickerTitle);
  console.log('tiers:', JSON.stringify(fsb.tiers?.map(t => ({
    id: t.id,
    goal: t.goal,
    gifts: (t.giftProducts || []).map(g => ({ handle: g.handle, title: g.title, variantId: g.variantId }))
  })), null, 2));

  console.log('\n=== giftMappings ===');
  console.log(JSON.stringify(cfg.giftMappings, null, 2));

  console.log('\n=== Config API output (what v14 sees) ===');
  const cartCfg = cfg;
  const addons = cartCfg.addons || {};
  const fsbCfg = addons.freeShippingBar?.config || {};
  console.log('GIFT_CUSTOMER_CHOICE would be:', !!fsbCfg.giftCustomerChoice);
  console.log('GIFT_TIERS count:', (fsbCfg.tiers || []).filter(t => (t.giftProducts?.length || 0) > 0 || t.giftProduct).length);

  await p.$disconnect();
})();
