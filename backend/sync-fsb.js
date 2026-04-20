const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findUnique({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    select: { config: true, demoConfig: true }
  });

  // Copy freeShippingBar from live config to demo config
  const liveAddons = store.config.addons;
  const demoConfig = store.demoConfig || {};
  const demoAddons = demoConfig.addons || {};

  // Copy freeShippingBar and upsellRecommendations (missing from demo)
  if (liveAddons.freeShippingBar) {
    demoAddons.freeShippingBar = liveAddons.freeShippingBar;
    console.log('Copied freeShippingBar to demoConfig');
  }
  if (liveAddons.upsellRecommendations) {
    demoAddons.upsellRecommendations = liveAddons.upsellRecommendations;
    console.log('Copied upsellRecommendations to demoConfig');
  }

  // Also copy shippingProtection settings from live
  if (liveAddons.shippingProtection) {
    demoAddons.shippingProtection = liveAddons.shippingProtection;
    console.log('Copied shippingProtection to demoConfig');
  }

  demoConfig.addons = demoAddons;

  await p.store.update({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    data: { demoConfig: demoConfig }
  });

  console.log('Done. demoConfig addon keys:', Object.keys(demoAddons));
  await p.$disconnect();
})();
