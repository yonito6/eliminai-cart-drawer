const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  // Get ALL collections with IDs
  const r = await gql(`{ collections(first: 50) { nodes { id title productsCount } } }`);
  console.log('=== ALL COLLECTIONS ===');
  for (const c of (r.data?.collections?.nodes || [])) {
    const marker = c.title.toLowerCase().includes('all') ? ' <<<<' : '';
    console.log(c.id, '|', c.title, '| count:', c.productsCount, marker);
  }

  // Check the exact collection the discount uses
  console.log('\n=== CHECKING DISCOUNT COLLECTION gid://shopify/Collection/399056961787 ===');
  const r2 = await gql(`{ node(id: "gid://shopify/Collection/399056961787") { ... on Collection { id title productsCount } } }`);
  console.log(JSON.stringify(r2.data, null, 2));

  // Check Ballistic's exact collections with IDs
  const r3 = await gql(`{ products(first: 1, query: "title:ballistic") { nodes { title collections(first: 30) { nodes { id title } } } } }`);
  console.log('\n=== BALLISTIC COLLECTIONS ===');
  const bcols = r3.data?.products?.nodes?.[0]?.collections?.nodes || [];
  for (const c of bcols) {
    console.log(c.id, '|', c.title);
  }

  // Check Wooden's exact collections with IDs
  const r4 = await gql(`{ products(first: 1, query: "title:Eleganto Wooden") { nodes { title collections(first: 30) { nodes { id title } } } } }`);
  console.log('\n=== WOODEN COLLECTIONS ===');
  const wcols = r4.data?.products?.nodes?.[0]?.collections?.nodes || [];
  for (const c of wcols) {
    const marker = c.id === 'gid://shopify/Collection/399056961787' ? ' <<<< DISCOUNT COLLECTION' : '';
    console.log(c.id, '|', c.title + marker);
  }

  await p.$disconnect();
})();
