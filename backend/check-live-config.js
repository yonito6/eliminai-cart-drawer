const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { config: true, demoConfig: true }
  });
  
  const config = store.config || {};
  const demoConfig = store.demoConfig || {};
  
  const fsb = config?.addons?.freeShippingBar?.config;
  const demoFsb = demoConfig?.addons?.freeShippingBar?.config;
  
  console.log('=== LIVE CONFIG tiers ===');
  console.log(JSON.stringify(fsb?.tiers, null, 2));
  console.log('\ngiftHandle:', fsb?.giftHandle);
  console.log('giftVariantId:', fsb?.giftVariantId);
  console.log('giftGoal:', fsb?.giftGoal);
  
  console.log('\n=== DEMO CONFIG tiers ===');
  console.log(JSON.stringify(demoFsb?.tiers, null, 2));
  
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
