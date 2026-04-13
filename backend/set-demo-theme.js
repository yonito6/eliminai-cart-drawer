const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  await p.store.update({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    data: { demoThemeId: '158622155003' }
  });
  const s = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { demoThemeId: true }
  });
  console.log('Set demoThemeId:', s.demoThemeId);
  await p.$disconnect();
})();
