const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  // Try REST API for storefront token
  var r = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/storefront_access_tokens.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ storefront_access_token: { title: 'Cart Test' } })
  });
  var data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
