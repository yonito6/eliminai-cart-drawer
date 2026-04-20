const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Rename old experiment to be descriptive
  const old = await p.experiment.updateMany({
    where: { name: 'Trust Badges - Fresh 50/50 Test', status: 'NO_DIFFERENCE' },
    data: { name: 'Trust Badges \u2014 Enabled vs Disabled' },
  });
  console.log('Renamed old experiments:', old.count);

  // Rename new running experiment
  const running = await p.experiment.updateMany({
    where: { name: 'Trust Badges - Fresh 50/50 Test', status: 'RUNNING' },
    data: { name: 'Trust Badges \u2014 Enabled vs Disabled' },
  });
  console.log('Renamed running experiments:', running.count);

  await p.$disconnect();
})();
