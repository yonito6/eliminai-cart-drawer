const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function shopifyGQL(domain, token, query) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

(async () => {
  // Test store
  const testStore = await p.store.findFirst({
    where: { shopDomain: { contains: 'eliminai-test' } },
    select: { shopDomain: true, accessToken: true },
  });

  if (testStore) {
    console.log('=== TEST STORE DISCOUNTS ===');
    const data = await shopifyGQL(testStore.shopDomain, testStore.accessToken, `{
      automaticDiscountNodes(first: 20) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title status
              customerBuys { value { ... on DiscountQuantity { quantity } } }
              customerGets {
                value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
                items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
              }
              usesPerOrderLimit
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
      }
    }`);
    const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
    for (const n of nodes) {
      const d = n.automaticDiscount;
      if (!d?.title) continue;
      console.log(`\n  ${d.title} (${d.status})`);
      console.log(`  ID: ${n.id}`);
      if (d.customerBuys) console.log(`  Buys qty: ${d.customerBuys.value?.quantity}`);
      if (d.customerGets) {
        console.log(`  Gets qty: ${d.customerGets.value?.quantity?.quantity}`);
        console.log(`  Gets effect: ${JSON.stringify(d.customerGets.value?.quantity?.effect)}`);
        console.log(`  Gets products: ${d.customerGets.items?.products?.nodes?.map(p => p.title).join(', ')}`);
      }
      if (d.usesPerOrderLimit !== undefined) console.log(`  usesPerOrderLimit: ${d.usesPerOrderLimit}`);
      if (d.combinesWith) console.log(`  combinesWith: ${JSON.stringify(d.combinesWith)}`);
    }
  }

  // Prod store
  const prodStore = await p.store.findFirst({
    where: { shopDomain: { contains: 'eleganto-3011' } },
    select: { shopDomain: true, accessToken: true },
  });

  if (prodStore) {
    console.log('\n\n=== PROD STORE DISCOUNTS ===');
    const data = await shopifyGQL(prodStore.shopDomain, prodStore.accessToken, `{
      automaticDiscountNodes(first: 20) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title status
              customerBuys { value { ... on DiscountQuantity { quantity } } }
              customerGets {
                value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
                items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
              }
              usesPerOrderLimit
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
      }
    }`);
    const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
    for (const n of nodes) {
      const d = n.automaticDiscount;
      if (!d?.title) continue;
      console.log(`\n  ${d.title} (${d.status})`);
      console.log(`  ID: ${n.id}`);
      if (d.customerBuys) console.log(`  Buys qty: ${d.customerBuys.value?.quantity}`);
      if (d.customerGets) {
        console.log(`  Gets qty: ${d.customerGets.value?.quantity?.quantity}`);
        console.log(`  Gets effect: ${JSON.stringify(d.customerGets.value?.quantity?.effect)}`);
        console.log(`  Gets products: ${d.customerGets.items?.products?.nodes?.map(p => p.title).join(', ')}`);
      }
      if (d.usesPerOrderLimit !== undefined) console.log(`  usesPerOrderLimit: ${d.usesPerOrderLimit}`);
      if (d.combinesWith) console.log(`  combinesWith: ${JSON.stringify(d.combinesWith)}`);
    }
  }

  await p.$disconnect();
})();
