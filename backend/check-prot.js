const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, config: true, demoConfig: true }
  });
  if (!store) { console.log('Store not found'); return; }
  const cfg = store.config || {};
  const demo = store.demoConfig || {};
  console.log('LIVE protection:', JSON.stringify(cfg.addons && cfg.addons.shippingProtection, null, 2));
  console.log('\nDEMO protection:', JSON.stringify(demo.addons && demo.addons.shippingProtection, null, 2));
}

main().finally(() => p.$disconnect());
