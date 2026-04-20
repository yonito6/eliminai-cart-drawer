const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  // Check Gift #2
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      node1: automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status usageCount
            customerBuys {
              items { ... on DiscountCollections { collections(first: 5) { nodes { id title } } } ... on DiscountProducts { products(first: 5) { nodes { id title } } } ... on AllDiscountItems { allItems } }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items { ... on DiscountProducts { products(first: 5) { nodes { id title } } productVariants(first: 5) { nodes { id title } } } }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  // Also check: what product is the watch case in our config?
  const storeConfig = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true }
  });
  const cartConfig = await p.cartConfig.findFirst({
    where: { storeId: storeConfig.id },
    select: { addons: true }
  });
  if (cartConfig) {
    console.log('\n--- Cart Config Addons ---');
    const addons = cartConfig.addons;
    if (addons && addons.rewards) {
      console.log('Rewards tiers:', JSON.stringify(addons.rewards.tiers, null, 2));
    }
  }

  await p.$disconnect();
})();
