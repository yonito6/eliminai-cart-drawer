const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findUnique({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    select: { config: true, demoConfig: true, demoThemeId: true }
  });
  console.log('demoThemeId:', store.demoThemeId);
  console.log('demoConfig has addons:', store.demoConfig && store.demoConfig.addons ? Object.keys(store.demoConfig.addons) : 'NO');
  console.log('config has addons:', store.config && store.config.addons ? Object.keys(store.config.addons) : 'NO');
  console.log('demoConfig keys:', store.demoConfig ? Object.keys(store.demoConfig) : 'EMPTY');
  console.log('demoConfig non-empty:', store.demoConfig ? Object.keys(store.demoConfig).length > 0 : false);
  await p.$disconnect();
})();
