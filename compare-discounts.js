const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const eleganto = await p.store.findUnique({
    where: { id: 'cmnriegez0000jc70ro9nltw2' },
    select: { shopDomain: true, accessToken: true }
  });
  const test = await p.store.findUnique({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    select: { shopDomain: true, accessToken: true }
  });

  async function queryDiscounts(store, label) {
    const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          automaticDiscountNodes(first: 20) {
            nodes {
              id
              automaticDiscount {
                ... on DiscountAutomaticBxgy {
                  title
                  status
                  combinesWith { productDiscounts orderDiscounts shippingDiscounts }
                  customerBuys { value { ... on DiscountQuantity { quantity } } }
                  customerGets {
                    items { ... on DiscountProducts { products(first: 3) { nodes { id title } } } }
                    value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } }
                  }
                }
                ... on DiscountAutomaticBasic { title status }
              }
            }
          }
          codeDiscountNodes(first: 20) {
            nodes {
              id
              codeDiscount {
                ... on DiscountCodeBxgy { title status codes(first: 1) { nodes { code } } }
                ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } }
                ... on DiscountCodeFreeShipping { title status codes(first: 1) { nodes { code } } }
              }
            }
          }
        }`
      })
    });
    const data = await res.json();

    console.log(`\n=== ${label} AUTOMATIC DISCOUNTS ===`);
    for (const n of data.data.automaticDiscountNodes.nodes) {
      const d = n.automaticDiscount;
      console.log(`  ${d.title} [${d.status}]`);
      if (d.customerBuys) console.log(`    Buy ${d.customerBuys.value.quantity} items`);
      if (d.customerGets) {
        const prods = d.customerGets.items.products?.nodes?.map(p => p.title) || [];
        const pct = d.customerGets.value?.effect?.percentage;
        console.log(`    Get: ${prods.join(', ')} at ${pct ? pct*100+'% off' : '?'}`);
      }
      if (d.combinesWith) console.log(`    Combines: product=${d.combinesWith.productDiscounts} order=${d.combinesWith.orderDiscounts} shipping=${d.combinesWith.shippingDiscounts}`);
    }

    console.log(`\n=== ${label} CODE DISCOUNTS ===`);
    for (const n of data.data.codeDiscountNodes.nodes) {
      const d = n.codeDiscount;
      const code = d.codes?.nodes?.[0]?.code || 'no-code';
      console.log(`  ${d.title} [${d.status}] code=${code}`);
    }
  }

  await queryDiscounts(eleganto, 'ELEGANTO (working)');
  await queryDiscounts(test, 'TEST STORE (broken)');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
