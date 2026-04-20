const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' } });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }
  const cfg = store.config || {};
  const rewards = cfg.addons?.rewards;
  console.log('Rewards enabled:', rewards?.enabled);
  const tiers = rewards?.config?.tiers || [];
  console.log('Tiers count:', tiers.length);
  for (const t of tiers) {
    const gifts = t.giftProducts || (t.giftProduct ? [t.giftProduct] : []);
    console.log('  Tier', t.id, '| goal:', t.goal, '| gifts:', gifts.length);
    for (const g of gifts) console.log('    -', g.title);
  }
  console.log('\ngiftCustomerChoice:', rewards?.config?.giftCustomerChoice);
  console.log('giftPickerTitle:', rewards?.config?.giftPickerTitle);
  await p.$disconnect();
})();
