const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { config: true } });
  const cfg = store.config || {};
  console.log('Config keys:', Object.keys(cfg));
  if (cfg.addons) console.log('addons:', JSON.stringify(cfg.addons, null, 2));
  if (cfg.rewards) console.log('rewards:', JSON.stringify(cfg.rewards, null, 2));
  // Show the full config in case gift info is elsewhere
  console.log('\nFull config:', JSON.stringify(cfg, null, 2));
  await p.$disconnect();
})();
