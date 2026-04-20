const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function run() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true, demoConfig: true, shopDomain: true }
  });
  if (!store) { console.log('Store not found'); return; }

  const backup = {
    storeId: store.id,
    shopDomain: store.shopDomain,
    backupDate: new Date().toISOString(),
    backupReason: 'Before switching Eleganto to app-created protection product',
    config: store.config,
    demoConfig: store.demoConfig,
    liquidConfig: {
      protectionEnabled: true,
      protectionHandle: 'shipping-protection-1',
      protectionVariantId: '47779174023419',
      note: 'These are the hardcoded values in live-snippets-cart-drawer.liquid on Eleganto theme'
    }
  };

  const filename = 'backup-eleganto-protection-switch-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
  fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
  console.log('Backup saved to:', filename);
  console.log('Config size:', JSON.stringify(store.config).length, 'bytes');

  // Show current protection config
  const cfg = store.config || {};
  const addons = cfg.addons || {};
  const sp = addons.shippingProtection || {};
  console.log('\n--- Current shippingProtection in DB ---');
  console.log(JSON.stringify(sp, null, 2));
}

run().finally(() => p.$disconnect());
