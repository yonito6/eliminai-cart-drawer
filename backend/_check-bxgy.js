const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true },
  });

  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNodes(first: 30) {
        nodes {
          id
          automaticDiscount {
            __typename
            ... on DiscountAutomaticBxgy {
              title
              status
              usesPerOrderLimit
              customerBuys {
                items {
                  ... on DiscountProducts {
                    products(first: 5) { nodes { id title } }
                  }
                  ... on DiscountCollections {
                    collections(first: 5) { nodes { id title } }
                  }
                  ... on AllDiscountItems { allItems }
                }
                value { ... on DiscountQuantity { quantity } }
              }
              customerGets {
                items {
                  ... on DiscountProducts { products(first: 5) { nodes { id title } } }
                }
                value {
                  ... on DiscountOnQuantity {
                    quantity { quantity }
                    effect { ... on DiscountPercentage { percentage } }
                  }
                }
              }
            }
            ... on DiscountAutomaticBasic {
              title
              status
            }
          }
        }
      }
    }` }),
  });
  const data = await res.json();
  const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
  for (const n of nodes) {
    const d = n.automaticDiscount;
    console.log('\n===', d.title || '(no title)', '===');
    console.log('  Type:', d.__typename, '| Status:', d.status);
    console.log('  ID:', n.id);
    if (d.__typename === 'DiscountAutomaticBxgy') {
      console.log('  Uses per order:', d.usesPerOrderLimit);
      console.log('  Customer BUYS:', d.customerBuys?.value?.quantity, 'items from:');
      const buyProducts = d.customerBuys?.items?.products?.nodes;
      const buyCollections = d.customerBuys?.items?.collections?.nodes;
      if (buyProducts?.length) console.log('    Products:', buyProducts.map(p => p.title).join(', '));
      if (buyCollections?.length) console.log('    Collections:', buyCollections.map(c => c.title).join(', '));
      if (d.customerBuys?.items?.allItems) console.log('    ALL items');
      console.log('  Customer GETS:', d.customerGets?.value?.quantity?.quantity, 'x');
      console.log('    Products:', d.customerGets?.items?.products?.nodes?.map(p => p.title).join(', '));
      console.log('    Effect:', d.customerGets?.value?.effect?.percentage ? (d.customerGets.value.effect.percentage * 100) + '% off' : '?');
    }
  }
  await p.$disconnect();
})();
