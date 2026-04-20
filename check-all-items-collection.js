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

  // Find all collections with "All" in the name
  const r1 = await gql(`{ collections(first: 20, query: "title:All") { nodes { id title productsCount ruleSet { rules { column relation condition } } } } }`);
  console.log('=== COLLECTIONS WITH "All" IN TITLE ===');
  for (const c of (r1.data?.collections?.nodes || [])) {
    console.log('ID:', c.id, '| Title:', c.title, '| Count:', c.productsCount);
    if (c.ruleSet) {
      console.log('  Rules:', JSON.stringify(c.ruleSet.rules));
    } else {
      console.log('  Type: MANUAL');
    }
  }

  // Check specifically what the Ballistic product's collections look like
  // vs what Wooden has - find the "All items" collection Wooden is in
  const r2 = await gql(`{ products(first: 1, query: "title:wooden") { nodes { title collections(first: 30) { nodes { id title } } } } }`);
  const woodenCollections = r2.data?.products?.nodes?.[0]?.collections?.nodes || [];
  const allItemsCol = woodenCollections.find(c => c.title === 'All items');

  if (allItemsCol) {
    console.log('\n=== "All items" COLLECTION (from Wooden product) ===');
    console.log('ID:', allItemsCol.id);

    // Now check this collection
    const r3 = await gql(`{
      collection(id: "${allItemsCol.id}") {
        id title productsCount
        ruleSet { rules { column relation condition } appliedDisjunctively }
        products(first: 100) { nodes { id title } }
      }
    }`);
    const col = r3.data?.collection;
    if (col) {
      console.log('Products count:', col.productsCount);
      if (col.ruleSet) {
        console.log('Type: AUTOMATED, Rules:', JSON.stringify(col.ruleSet.rules));
      } else {
        console.log('Type: MANUAL');
      }
      console.log('\nProducts:');
      const ballistic = col.products.nodes.find(p => p.title.toLowerCase().includes('ballistic'));
      for (const p of col.products.nodes) {
        const marker = p.title.toLowerCase().includes('ballistic') ? ' <<<< BALLISTIC' : '';
        console.log('  -', p.title + marker);
      }
      if (!ballistic) {
        console.log('\n  *** BALLISTIC NOT IN THIS COLLECTION ***');
      }
    }
  }

  // Also check: is the collection ID in the discount the same as the one Wooden is in?
  console.log('\n=== DISCOUNT COLLECTION ID vs ACTUAL ===');
  console.log('Discount points to: gid://shopify/Collection/399056961787');
  console.log('Wooden is in:      ', allItemsCol?.id || 'NOT FOUND');
  console.log('Match:', allItemsCol?.id === 'gid://shopify/Collection/399056961787' ? 'YES' : '*** MISMATCH ***');

  await p.$disconnect();
})();
