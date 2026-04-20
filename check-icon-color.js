const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const stores = await p.store.findMany({ select: { shopDomain: true, config: true } });
  for (const s of stores) {
    const sp = s.config?.addons?.shippingProtection?.config || {};
    console.log(s.shopDomain, '→ iconColor:', sp.iconColor || '(none)', '| iconId:', sp.iconId || '(none)');
  }
  await p.$disconnect();
})();
