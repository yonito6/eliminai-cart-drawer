const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true, config: true }
  });
  const cfg = store.config || {}; console.log('Protection variant ID:', cfg.protectionVariantId || 'not set');

  const query = `{
    products(first: 5, query: "title:*protection*") {
      nodes {
        id title status
        variants(first: 1) { nodes { id price } }
        collections(first: 20) { nodes { id title } }
      }
    }
  }`;

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  const products = data.data.products.nodes;
  products.forEach(function(prod) {
    console.log('\nProduct:', prod.title);
    console.log('  ID:', prod.id);
    console.log('  Status:', prod.status);
    console.log('  Price: $' + prod.variants.nodes[0].price);
    console.log('  Collections:', prod.collections.nodes.map(function(c) { return c.title; }).join(', ') || 'NONE');
  });
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
