const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true }
  });
  const cfg = store.config || {};
  const sp = (cfg.addons || {}).shippingProtection || {};
  console.log('--- Eleganto shippingProtection after dashboard save ---');
  console.log(JSON.stringify(sp, null, 2));
  console.log('\nHas handle:', !!sp.handle || !!(sp.config && sp.config.handle));
  console.log('Has productId:', !!sp.productId || !!(sp.config && sp.config.productId));
  console.log('Has tiers:', !!(sp.tiers && sp.tiers.length > 0));
}

run().finally(() => p.$disconnect());
