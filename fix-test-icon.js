const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, config: true }
  });
  const cfg = store.config || {};
  const sp = cfg.addons?.shippingProtection || {};
  sp.config = {
    ...(sp.config || {}),
    iconId: 'shield-filled',
  };
  cfg.addons = { ...cfg.addons, shippingProtection: sp };
  await p.store.update({ where: { id: store.id }, data: { config: cfg } });
  console.log('Updated iconId to shield-filled');
  await p.$disconnect();
})();
