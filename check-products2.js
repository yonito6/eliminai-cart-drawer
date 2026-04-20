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

  // Search ballistic
  const r1 = await gql(`{ products(first: 5, query: "ballistic") { nodes { id title status collections(first: 20) { nodes { id title } } } } }`);
  console.log('=== BALLISTIC SEARCH ===');
  for (const p of (r1.data?.products?.nodes || [])) {
    console.log('Product:', p.title, '| Status:', p.status);
    console.log('  Collections:', p.collections.nodes.map(c => c.title).join(', ') || 'NONE');
    const inAll = p.collections.nodes.some(c => c.id === 'gid://shopify/Collection/399056961787');
    console.log('  In "All items":', inAll ? 'YES' : '*** NO ***');
  }

  // Search wooden
  const r2 = await gql(`{ products(first: 5, query: "wooden") { nodes { id title status collections(first: 20) { nodes { id title } } } } }`);
  console.log('\n=== WOODEN SEARCH ===');
  for (const p of (r2.data?.products?.nodes || [])) {
    console.log('Product:', p.title, '| Status:', p.status);
    console.log('  Collections:', p.collections.nodes.map(c => c.title).join(', ') || 'NONE');
    const inAll = p.collections.nodes.some(c => c.id === 'gid://shopify/Collection/399056961787');
    console.log('  In "All items":', inAll ? 'YES' : '*** NO ***');
  }

  // Check the collection details
  const r3 = await gql(`{
    collection(id: "gid://shopify/Collection/399056961787") {
      id title productsCount
      ruleSet { rules { column relation condition } appliedDisjunctively }
      products(first: 50) { nodes { id title } }
    }
  }`);
  console.log('\n=== "All items" COLLECTION (ID 399056961787) ===');
  const col = r3.data?.collection;
  if (col) {
    console.log('Title:', col.title, '| Count:', col.productsCount);
    if (col.ruleSet) {
      console.log('Type: AUTOMATED');
      console.log('Disjunctive:', col.ruleSet.appliedDisjunctively);
      console.log('Rules:', JSON.stringify(col.ruleSet.rules, null, 2));
    } else {
      console.log('Type: MANUAL');
    }
    console.log('Products in collection:');
    for (const p of (col.products?.nodes || [])) {
      console.log('  -', p.title);
    }
  } else {
    console.log('COLLECTION NOT FOUND!');
  }

  await p.$disconnect();
})();
