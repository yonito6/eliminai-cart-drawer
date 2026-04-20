const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  var s = await p.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' }, select: { shopDomain: true, accessToken: true } });
  // Try publishedAt and onlineStoreUrl instead
  var q = '{ products(first: 3, query: "title:*snowboard* status:active") { edges { node { id title handle onlineStoreUrl } } } }';
  var res = await fetch('https://' + s.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': s.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  var data = await res.json();
  if (data.errors) console.log('ERRORS:', JSON.stringify(data.errors));
  else {
    data.data.products.edges.forEach(function(e) {
      console.log(e.node.handle, '| onlineStoreUrl:', e.node.onlineStoreUrl);
    });
  }
  await p.$disconnect();
})();
