const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true, config: true }
  });
  if (!store || !store.accessToken) { console.log('No token'); return; }

  const cfg = store.config || {};
  const protCfg = cfg.addons && cfg.addons.shippingProtection;
  console.log('Eleganto protection config:', JSON.stringify(protCfg, null, 2));
}
check().finally(() => p.$disconnect());
