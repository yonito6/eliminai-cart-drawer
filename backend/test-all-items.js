const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  
  // Check Shopify API schema for DiscountItemsInput
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __type(name: "DiscountItemsInput") { inputFields { name type { name kind ofType { name } } } } }' })
  });
  var data = await res.json();
  console.log('DiscountItemsInput fields:', JSON.stringify(data.data, null, 2));
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
