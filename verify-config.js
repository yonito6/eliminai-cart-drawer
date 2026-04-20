const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, config: true }
  });
  const sp = store.config?.addons?.shippingProtection || {};
  console.log('=== Shipping Protection Config ===');
  console.log('enabled:', sp.enabled);
  console.log('handle:', sp.handle);
  console.log('variantId (top):', sp.variantId);
  console.log('config.variantId:', sp.config?.variantId);
  console.log('config.price:', sp.config?.price);
  console.log('config.singlePrice:', sp.config?.singlePrice);
  console.log('config.productName:', sp.config?.productName);
  await p.$disconnect();
})();
