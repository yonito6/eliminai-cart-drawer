const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: { contains: 'eleganto-3011' } }, select: { shopDomain: true, accessToken: true } });
  if (!store) { console.log('No store'); return; }
  
  // Check necklace product by handle
  const r1 = await gql(store.shopDomain, store.accessToken, `
    query productByIdentifier($identifier: ProductIdentifierInput!) {
      productByIdentifier(identifier: $identifier) { id title status }
    }
  `, { identifier: { handle: 'geotrianglenecklace' } });
  console.log('Necklace (geotrianglenecklace):', JSON.stringify(r1?.data?.productByIdentifier));
  
  // Check case product by handle
  const r2 = await gql(store.shopDomain, store.accessToken, `
    query productByIdentifier($identifier: ProductIdentifierInput!) {
      productByIdentifier(identifier: $identifier) { id title status }
    }
  `, { identifier: { handle: 'eleganto-premium-watch-organizer' } });
  console.log('Case (eleganto-premium-watch-organizer):', JSON.stringify(r2?.data?.productByIdentifier));
  
  // Also search for necklace products
  const r3 = await gql(store.shopDomain, store.accessToken, `{
    products(first: 10, query: "title:necklace") {
      nodes { id title handle status }
    }
  }`);
  console.log('\nNecklace products:', JSON.stringify(r3?.data?.products?.nodes, null, 2));
  
  await p.$disconnect();
})();
