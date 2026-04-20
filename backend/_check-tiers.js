const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const domain of ['eleganto-3011.myshopify.com', 'eliminai-test.myshopify.com']) {
    const store = await p.store.findUnique({
      where: { shopDomain: domain },
      select: { config: true, demoConfig: true },
    });
    const cfg = typeof store.config === 'string' ? JSON.parse(store.config) : (store.config || {});
    const demoCfg = typeof store.demoConfig === 'string' ? JSON.parse(store.demoConfig) : (store.demoConfig || {});
    const rewards = cfg?.addons?.freeShippingBar;
    const demoRewards = demoCfg?.addons?.freeShippingBar;
    console.log('\n' + domain + ':');
    console.log('  LIVE rewards config:', JSON.stringify(rewards?.config?.tiers || 'NOT SET', null, 2));
    console.log('  DEMO rewards config:', JSON.stringify(demoRewards?.config?.tiers || 'NOT SET', null, 2));
  }
  await p.$disconnect();
})();
