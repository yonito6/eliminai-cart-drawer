const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { config: true },
  });
  const cfg = typeof store.config === 'string' ? JSON.parse(store.config) : store.config;
  const trust = cfg?.addons?.trustBadges;
  console.log('Eleganto trustBadges addon config:');
  console.log(JSON.stringify(trust, null, 2));
  await p.$disconnect();
})();
