const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  // Check Eleganto's protection config
  const eleganto = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true }
  });
  const sp = eleganto?.config?.addons?.shippingProtection || {};
  console.log('=== Eleganto Protection Config ===');
  console.log(JSON.stringify(sp, null, 2));

  // Check eliminai-test protection config
  const test = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, config: true }
  });
  const tsp = test?.config?.addons?.shippingProtection || {};
  console.log('\n=== Eliminai-Test Protection Config ===');
  console.log(JSON.stringify(tsp, null, 2));

  await p.$disconnect();
})();
