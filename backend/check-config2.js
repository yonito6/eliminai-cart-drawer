const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { config: true, demoConfig: true } });
  var cfg = store.config || {};
  var demo = store.demoConfig || {};
  // Check all keys that might contain gift info
  for (var key of Object.keys(cfg)) {
    if (key.toLowerCase().includes('gift') || key.toLowerCase().includes('tier') || key.toLowerCase().includes('milestone')) {
      console.log('config.' + key + ':', JSON.stringify(cfg[key], null, 2));
    }
  }
  for (var key of Object.keys(demo)) {
    if (key.toLowerCase().includes('gift') || key.toLowerCase().includes('tier') || key.toLowerCase().includes('milestone')) {
      console.log('demoConfig.' + key + ':', JSON.stringify(demo[key], null, 2));
    }
  }
  // Also dump all config keys
  console.log('\nAll config keys:', Object.keys(cfg).join(', '));
  console.log('All demoConfig keys:', Object.keys(demo).join(', '));
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
