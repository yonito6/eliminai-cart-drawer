const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Get products from "All Watch" collection
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      collectionByHandle(handle: "all-watch") {
        title
        products(first: 5) {
          nodes {
            title
            handle
            status
            variants(first: 3) {
              nodes {
                id
                title
                price
                availableForSale
              }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  if (data.errors) { console.error(JSON.stringify(data.errors)); return; }
  const products = data.data.collectionByHandle.products.nodes;
  products.forEach(p => {
    console.log('\n' + p.title + ' (' + p.handle + ') status=' + p.status);
    p.variants.nodes.forEach(v => {
      const numId = v.id.split('/').pop();
      console.log('  variant ' + numId + ' | ' + v.title + ' | $' + v.price + ' | avail=' + v.availableForSale);
    });
  });
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
