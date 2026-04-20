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

  // Find Ballistic with full details
  const r = await gql(`{
    products(first: 5, query: "title:*ballistic*") {
      nodes {
        id
        title
        status
        tags
        collections(first: 30) {
          nodes { id title }
        }
      }
    }
  }`);

  console.log('=== BALLISTIC PRODUCT ===');
  for (const prod of (r.data?.products?.nodes || [])) {
    console.log('Title:', prod.title);
    console.log('ID:', prod.id);
    console.log('Status:', prod.status);
    console.log('Tags:', prod.tags.join(', '));
    console.log('Collections (' + prod.collections.nodes.length + '):');
    for (const c of prod.collections.nodes) {
      const marker = c.id === 'gid://shopify/Collection/399056961787' ? ' <<<< DISCOUNT COLLECTION' : '';
      console.log('  ', c.id, '|', c.title + marker);
    }
    const inAllItems = prod.collections.nodes.some(c => c.id === 'gid://shopify/Collection/399056961787');
    console.log('\nIN "All items" (discount collection):', inAllItems ? 'YES' : '*** NO - THIS IS WHY THE DISCOUNT DOESNT APPLY ***');
  }

  // Also check: what products ARE in the discount collection?
  const r2 = await gql(`{
    collection(id: "gid://shopify/Collection/399056961787") {
      id title productsCount
      products(first: 50) { nodes { id title } }
    }
  }`);

  if (r2.data?.collection) {
    const col = r2.data.collection;
    console.log('\n=== PRODUCTS IN DISCOUNT COLLECTION "' + col.title + '" (' + col.productsCount + ' total) ===');
    for (const prod of col.products.nodes) {
      const isBallistic = prod.title.toLowerCase().includes('ballistic');
      console.log('  ', prod.title + (isBallistic ? ' <<<< BALLISTIC IS HERE' : ''));
    }
    if (!col.products.nodes.some(p => p.title.toLowerCase().includes('ballistic'))) {
      console.log('\n  *** BALLISTIC IS NOT IN THIS COLLECTION ***');
    }
  } else {
    console.log('\n=== DISCOUNT COLLECTION NOT ACCESSIBLE ===');
    console.log(JSON.stringify(r2, null, 2));
  }

  await p.$disconnect();
})();
