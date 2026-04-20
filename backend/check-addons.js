const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { config: true, demoConfig: true } });
  var cfg = store.config || {};
  var demo = store.demoConfig || {};
  var addons = cfg.addons || {};
  var demoAddons = demo.addons || {};
  
  // Find gift/tier related addon
  if (addons.milestoneGifts) console.log('config.addons.milestoneGifts:', JSON.stringify(addons.milestoneGifts, null, 2));
  if (demoAddons.milestoneGifts) console.log('demo.addons.milestoneGifts:', JSON.stringify(demoAddons.milestoneGifts, null, 2));
  
  // Dump all addon keys
  console.log('\nconfig.addons keys:', Object.keys(addons).join(', '));
  console.log('demo.addons keys:', Object.keys(demoAddons).join(', '));
  
  // Look for anything with tiers/gifts
  for (var key of Object.keys(addons)) {
    var val = addons[key];
    if (val && typeof val === 'object' && (val.tiers || val.giftTiers || val.milestones)) {
      console.log('\nconfig.addons.' + key + ':', JSON.stringify(val, null, 2));
    }
  }
  for (var key of Object.keys(demoAddons)) {
    var val = demoAddons[key];
    if (val && typeof val === 'object' && (val.tiers || val.giftTiers || val.milestones)) {
      console.log('\ndemo.addons.' + key + ':', JSON.stringify(val, null, 2));
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
