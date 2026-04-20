const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  // Search for the products
  const query = `{
    products(first: 10, query: "title:Eleganto AND (title:ballistic OR title:wooden)") {
      nodes {
        id
        title
        status
        variants(first: 5) {
          nodes {
            id
            title
            price
          }
        }
        collections(first: 20) {
          nodes {
            id
            title
          }
        }
      }
    }
    collection(id: "gid://shopify/Collection/399056961787") {
      id
      title
      productsCount
      ruleSet {
        rules {
          column
          relation
          condition
        }
      }
    }
  }`;

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();

  console.log('=== PRODUCTS ===');
  if (data.data?.products?.nodes) {
    for (const p of data.data.products.nodes) {
      console.log('\nProduct:', p.title, '| Status:', p.status, '| ID:', p.id);
      console.log('  Variants:', p.variants.nodes.map(v => v.title + ' $' + v.price).join(', '));
      console.log('  Collections:', p.collections.nodes.map(c => c.title).join(', '));
      const inAllItems = p.collections.nodes.some(c => c.id === 'gid://shopify/Collection/399056961787');
      console.log('  IN "All items" collection:', inAllItems ? 'YES' : '*** NO ***');
    }
  }

  console.log('\n=== "All items" COLLECTION ===');
  if (data.data?.collection) {
    const col = data.data.collection;
    console.log('Title:', col.title, '| Products count:', col.productsCount);
    if (col.ruleSet) {
      console.log('Rules:', JSON.stringify(col.ruleSet.rules, null, 2));
    } else {
      console.log('Type: MANUAL (no automated rules)');
    }
  }

  await p.$disconnect();
})();
