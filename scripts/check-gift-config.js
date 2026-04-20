#!/usr/bin/env node
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true, demoConfig: true },
  });
  if (!store) { console.log('Store not found'); return; }
  console.log('Store ID:', store.id);

  const cfg = store.config || {};
  const addons = cfg.addons || {};
  const fsb = addons.freeShippingBar?.config || {};
  console.log('\n=== LIVE CONFIG ===');
  console.log('Tiers:', JSON.stringify(fsb.tiers, null, 2));
  console.log('\nGift Mappings:', JSON.stringify(cfg.giftMappings, null, 2));

  const demoCfg = store.demoConfig || {};
  const demoAddons = demoCfg.addons || {};
  const demoFsb = demoAddons.freeShippingBar?.config || {};
  console.log('\n=== DEMO CONFIG ===');
  console.log('Tiers:', JSON.stringify(demoFsb.tiers, null, 2));
  console.log('\nGift Mappings:', JSON.stringify(demoCfg.giftMappings, null, 2));

  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
