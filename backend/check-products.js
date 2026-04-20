const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true, config: true } });
  console.log('Gift config:', JSON.stringify(store.config?.giftTiers || [], null, 2));
  
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ products(first: 10, query: "status:active") { nodes { id title handle status } } }' })
  });
  var data = await res.json();
  console.log('\nAll active products:');
  for (var n of data.data.products.nodes) {
    console.log('  ' + n.id + ' — ' + n.title + ' [' + n.status + '] handle=' + n.handle);
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
