const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true, demoConfig: true }
  });
  const cfg = store.config || {};
  const demo = store.demoConfig || {};
  console.log('=== LIVE config.addons.shippingProtection ===');
  console.log(JSON.stringify(cfg?.addons?.shippingProtection, null, 2));
  console.log('\n=== DEMO config.addons.shippingProtection ===');
  console.log(JSON.stringify(demo?.addons?.shippingProtection, null, 2));
  await p.$disconnect();
}
main();
