const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  // Check 1+1 FREE full details
  console.log('=== 1+1 FREE ===');
  const d1 = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1622934880507") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status
          combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          customerBuys {
            items {
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              ... on DiscountProducts { products(first: 10) { nodes { id title } } }
              ... on AllDiscountItems { allItems }
            }
            value { ... on DiscountQuantity { quantity } ... on DiscountPurchaseAmount { amount } }
          }
          customerGets {
            items {
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              ... on DiscountProducts { products(first: 10) { nodes { id title } } productVariants(first: 10) { nodes { id title } } }
            }
            value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
          }
          usesPerOrderLimit
        }
      }
    }
  }`);
  console.log(JSON.stringify(d1?.data?.automaticDiscountNode?.automaticDiscount, null, 2));

  // Check 1+2 FREE full details
  console.log('\n=== 1+2 FREE ===');
  const d2 = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787605647611") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status
          combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          customerBuys {
            items {
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              ... on DiscountProducts { products(first: 10) { nodes { id title } } }
              ... on AllDiscountItems { allItems }
            }
            value { ... on DiscountQuantity { quantity } ... on DiscountPurchaseAmount { amount } }
          }
          customerGets {
            items {
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              ... on DiscountProducts { products(first: 10) { nodes { id title } } productVariants(first: 10) { nodes { id title } } }
            }
            value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
          }
          usesPerOrderLimit
        }
      }
    }
  }`);
  console.log(JSON.stringify(d2?.data?.automaticDiscountNode?.automaticDiscount, null, 2));

  await p.$disconnect();
})();
