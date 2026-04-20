const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, config: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }

  const cfg = store.config || {};
  const addons = cfg.addons || {};

  // Update shipping protection config with correct price
  addons.shippingProtection = {
    ...addons.shippingProtection,
    config: {
      ...((addons.shippingProtection || {}).config || {}),
      price: 4.99,
      singlePrice: 4.99,
      iconId: 'shield-check',
      defaultOn: true,
      productName: 'Shipping Protection',
      description: 'Covers lost, stolen, or damaged packages',
      pricingMode: 'single',
    },
    enabled: true,
  };

  cfg.addons = addons;
  await p.store.update({ where: { id: store.id }, data: { config: cfg } });
  console.log('Updated! New config:', JSON.stringify(addons.shippingProtection, null, 2));
  await p.$disconnect();
})();
