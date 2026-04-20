const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function backup() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, config: true, demoConfig: true }
  });
  if (!store) { console.log('Store not found'); return; }

  const backupData = {
    storeId: store.id,
    backupDate: new Date().toISOString(),
    config: store.config,
    demoConfig: store.demoConfig
  };

  const filename = `backup-eleganto-config-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
  console.log('Backup saved to:', filename);
  console.log('Config size:', JSON.stringify(store.config).length, 'bytes');
  console.log('DemoConfig size:', JSON.stringify(store.demoConfig).length, 'bytes');
}
backup().finally(() => p.$disconnect());
