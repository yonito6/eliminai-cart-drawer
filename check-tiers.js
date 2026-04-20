const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { config: true }
  });
  const cfg = store.config || {};
  const tiers = cfg.addons?.freeShippingBar?.config?.tiers || [];
  tiers.forEach(function(t, i) {
    console.log('Tier', i+1, 'goal=' + t.goal);
    const gifts = t.giftProducts || (t.giftProduct ? [t.giftProduct] : []);
    gifts.forEach(function(g) { console.log('  gift:', g.handle, 'variantId=' + g.variantId, 'originalHandle=' + (g.originalHandle || 'none')); });
  });
  if (tiers.length === 0) console.log('NO TIERS FOUND');
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
