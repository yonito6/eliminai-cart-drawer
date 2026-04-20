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

  const COLLECTION_ID = 'gid://shopify/Collection/399056961787';

  // Step 1: Get ALL active products
  let allProducts = [];
  let cursor = null;
  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const r = await gql(`{ products(first: 50, query: "status:active"${afterClause}) { nodes { id title tags } pageInfo { hasNextPage endCursor } } }`);
    const nodes = r.data?.products?.nodes || [];
    allProducts = allProducts.concat(nodes);
    if (!r.data?.products?.pageInfo?.hasNextPage) break;
    cursor = r.data.products.pageInfo.endCursor;
  }
  console.log('Total active products:', allProducts.length);

  // Filter: only real products (not [Gift] duplicates, not test products)
  const realProducts = allProducts.filter(p =>
    !p.title.startsWith('[Gift]') &&
    !p.title.toLowerCase().includes('test') &&
    !p.title.toLowerCase().includes('dummy')
  );
  console.log('Real products (excluding [Gift]/test):', realProducts.length);

  // Step 2: Get all products in the "All items" collection
  let collectionProducts = [];
  cursor = null;
  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const r = await gql(`{ collection(id: "${COLLECTION_ID}") { products(first: 50${afterClause}) { nodes { id title } pageInfo { hasNextPage endCursor } } } }`);
    const nodes = r.data?.collection?.products?.nodes || [];
    collectionProducts = collectionProducts.concat(nodes);
    if (!r.data?.collection?.products?.pageInfo?.hasNextPage) break;
    cursor = r.data.collection.products.pageInfo.endCursor;
  }
  console.log('Products in "All items" collection:', collectionProducts.length);

  const collectionIds = new Set(collectionProducts.map(p => p.id));

  // Step 3: Find missing products
  const missing = realProducts.filter(p => !collectionIds.has(p.id));

  console.log('\n=== MISSING FROM "All items" COLLECTION ===');
  if (missing.length === 0) {
    console.log('All real products are in the collection!');
  } else {
    console.log(missing.length + ' products MISSING:');
    for (const m of missing) {
      console.log('  -', m.title, '| ID:', m.id, '| Tags:', m.tags.join(', '));
    }
  }

  // Step 4: Add Ballistic to the collection
  console.log('\n=== ADDING BALLISTIC TO COLLECTION ===');
  const ballisticId = 'gid://shopify/Product/8962816540923';
  const addRes = await gql(`mutation {
    collectionAddProducts(id: "${COLLECTION_ID}", productIds: ["${ballisticId}"]) {
      collection { id title }
      userErrors { field message }
    }
  }`);

  if (addRes.data?.collectionAddProducts?.userErrors?.length > 0) {
    console.log('ERROR:', JSON.stringify(addRes.data.collectionAddProducts.userErrors));
  } else if (addRes.data?.collectionAddProducts?.collection) {
    console.log('SUCCESS: Added Ballistic to', addRes.data.collectionAddProducts.collection.title);
  } else {
    console.log('Response:', JSON.stringify(addRes, null, 2));
  }

  await p.$disconnect();
})();
