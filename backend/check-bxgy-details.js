const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  async function gql(query) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  }

  // Check "1+2 FREE" in detail
  const detail = await gql(`{
    node(id: "gid://shopify/DiscountAutomaticNode/1787605647611") {
      ... on DiscountAutomaticNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts { products(first: 50) { nodes { id title handle } } productVariants(first: 50) { nodes { id title } } }
                ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              }
              value { ... on DiscountQuantity { quantity } ... on DiscountPurchaseAmount { amount } }
            }
            customerGets {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts { products(first: 50) { nodes { id title handle } } productVariants(first: 50) { nodes { id title } } }
                ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }
  }`);

  console.log('=== 1+2 FREE DETAILS ===');
  console.log(JSON.stringify(detail?.data?.node?.automaticDiscount, null, 2));

  // Also check "1+1 FREE"
  const detail2 = await gql(`{
    node(id: "gid://shopify/DiscountAutomaticNode/1622934880507") {
      ... on DiscountAutomaticNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts { products(first: 50) { nodes { id title handle } } }
                ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts { products(first: 50) { nodes { id title handle } } }
                ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
              }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }
  }`);

  console.log('\n=== 1+1 FREE DETAILS ===');
  console.log(JSON.stringify(detail2?.data?.node?.automaticDiscount, null, 2));

  // Check the current cart state
  const cartRes = await fetch('https://eleganto-3011.myshopify.com/cart.json');
  const cart = await cartRes.json();
  console.log('\n=== CURRENT CART ===');
  console.log('Items:', cart.items?.length);
  for (const item of cart.items || []) {
    console.log(`  ${item.handle}: $${(item.final_line_price / 100).toFixed(2)} (orig: $${(item.original_line_price / 100).toFixed(2)}) discounts: ${JSON.stringify(item.discounts?.map(d => d.title))}`);
  }
  console.log('Total:', (cart.total_price / 100).toFixed(2));
  console.log('Total discount:', (cart.total_discount / 100).toFixed(2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
