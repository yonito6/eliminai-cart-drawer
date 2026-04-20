const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

async function main() {
  const test = await p.store.findUnique({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    select: { shopDomain: true, accessToken: true }
  });
  const eleganto = await p.store.findUnique({
    where: { id: 'cmnriegez0000jc70ro9nltw2' },
    select: { shopDomain: true, accessToken: true }
  });

  const query = `{
    automaticDiscountNodes(first: 20) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            usesPerOrderLimit
            startsAt
            endsAt
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys {
              items {
                ... on DiscountProducts {
                  productVariantsCount
                  products(first: 3) { nodes { id title status } }
                }
                ... on AllDiscountItems { allItems }
              }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items {
                ... on DiscountProducts {
                  products(first: 3) { nodes { id title status } }
                }
              }
              value {
                ... on DiscountOnQuantity {
                  quantity { ... on DiscountQuantity { quantity } }
                  effect { ... on DiscountPercentage { percentage } }
                }
              }
            }
          }
          ... on DiscountAutomaticBasic { title status }
        }
      }
    }
  }`;

  console.log('=== TEST STORE — FULL AUTOMATIC DISCOUNT DETAILS ===');
  const testData = await gql(test.shopDomain, test.accessToken, query);
  for (const n of testData.data.automaticDiscountNodes.nodes) {
    const d = n.automaticDiscount;
    if (!d.customerBuys) { console.log(`  ${d.title} [${d.status}] (Basic, not BXGY)`); continue; }
    console.log(`\n  ${d.title} [${d.status}]`);
    console.log(`    usesPerOrderLimit: ${d.usesPerOrderLimit}`);
    console.log(`    startsAt: ${d.startsAt} | endsAt: ${d.endsAt}`);
    console.log(`    combinesWith: product=${d.combinesWith.productDiscounts} order=${d.combinesWith.orderDiscounts} shipping=${d.combinesWith.shippingDiscounts}`);
    console.log(`    customerBuys:`);
    console.log(`      quantity: ${d.customerBuys.value.quantity}`);
    const buyItems = d.customerBuys.items;
    if (buyItems.allItems !== undefined) {
      console.log(`      items: ALL ITEMS`);
    } else if (buyItems.products) {
      console.log(`      products (first 3): ${buyItems.products.nodes.map(p => `${p.title} [${p.status}]`).join(', ')}`);
      console.log(`      variants count: ${buyItems.productVariantsCount}`);
    }
    console.log(`    customerGets:`);
    console.log(`      products: ${d.customerGets.items.products?.nodes?.map(p => `${p.title} [${p.status}]`).join(', ')}`);
    console.log(`      quantity: ${d.customerGets.value?.quantity?.quantity} at ${d.customerGets.value?.effect?.percentage * 100}% off`);
  }

  console.log('\n\n=== ELEGANTO — FULL BXGY DISCOUNT DETAILS ===');
  const eData = await gql(eleganto.shopDomain, eleganto.accessToken, query);
  for (const n of eData.data.automaticDiscountNodes.nodes) {
    const d = n.automaticDiscount;
    if (!d.customerBuys) { console.log(`  ${d.title} [${d.status}] (Basic, not BXGY)`); continue; }
    console.log(`\n  ${d.title} [${d.status}]`);
    console.log(`    usesPerOrderLimit: ${d.usesPerOrderLimit}`);
    console.log(`    combinesWith: product=${d.combinesWith.productDiscounts} order=${d.combinesWith.orderDiscounts} shipping=${d.combinesWith.shippingDiscounts}`);
    console.log(`    customerBuys:`);
    console.log(`      quantity: ${d.customerBuys.value.quantity}`);
    const buyItems = d.customerBuys.items;
    if (buyItems.allItems !== undefined) {
      console.log(`      items: ALL ITEMS`);
    } else if (buyItems.products) {
      console.log(`      products (first 3): ${buyItems.products.nodes.map(p => `${p.title} [${p.status}]`).join(', ')}`);
      console.log(`      variants count: ${buyItems.productVariantsCount}`);
    }
    console.log(`    customerGets:`);
    console.log(`      products: ${d.customerGets.items.products?.nodes?.map(p => `${p.title} [${p.status}]`).join(', ')}`);
    console.log(`      quantity: ${d.customerGets.value?.quantity?.quantity} at ${d.customerGets.value?.effect?.percentage * 100}% off`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
