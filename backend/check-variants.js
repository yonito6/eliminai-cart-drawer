const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const e = await p.experiment.findFirst({
    where: { status: 'RUNNING' },
    select: { variants: true, liftPercent: true, confidence: true, trafficSplit: true }
  });
  console.log(JSON.stringify(e, null, 2));
  await p.$disconnect();
})();
