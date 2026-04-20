const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, config: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }
  const cfg = store.config || {};
  const addons = cfg.addons || {};
  console.log('Store ID:', store.id);
  console.log('Addons keys:', Object.keys(addons));
  console.log('\nShipping Protection:', JSON.stringify(addons.shippingProtection || 'NOT SET', null, 2));
  console.log('\nFull addons config:');
  console.log(JSON.stringify(addons, null, 2));
  await p.$disconnect();
})();
