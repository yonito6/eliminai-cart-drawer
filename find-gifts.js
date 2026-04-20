const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  async function gql(query) {
    var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    return res.json();
  }

  var result = await gql('{ products(first: 30, query: "title:gift OR title:case OR handle:gift") { nodes { id title handle status variants(first:1) { nodes { id price compareAtPrice } } } } }');
  console.log('Products matching gift/case:');
  result.data.products.nodes.forEach(function(n) {
    var v = n.variants.nodes[0];
    console.log('  ' + n.status + ' | ' + n.handle + ' | ' + n.title + ' | $' + v.price + (v.compareAtPrice ? ' (was $' + v.compareAtPrice + ')' : '') + ' | vid=' + v.id.split('/').pop());
  });

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
