const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function fix() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  async function gql(query, variables) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  }

  // Enable combining on 1+2 FREE and 1+1 FREE so our case discount can stack
  const bxgyIds = [
    'gid://shopify/DiscountAutomaticNode/1588433027323',  // 1+2 FREE
    'gid://shopify/DiscountAutomaticNode/1622934880507',  // 1+1 FREE
  ];
  for (const id of bxgyIds) {
    const r = await gql(`
      mutation discountAutomaticBxgyUpdate($id: ID!, $discount: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $discount) {
          automaticDiscountNode { automaticDiscount { ... on DiscountAutomaticBxgy { title combinesWith { productDiscounts orderDiscounts shippingDiscounts } } } }
          userErrors { field message }
        }
      }
    `, { id, discount: { combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true } } });
    const d = r?.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode?.automaticDiscount;
    console.log(`${d?.title}: combines=${JSON.stringify(d?.combinesWith)}`);
  }

  // Verify all discounts
  const all = await gql(`{ automaticDiscountNodes(first: 50) { nodes { id automaticDiscount { ... on DiscountAutomaticBasic { title status combinesWith { productDiscounts } } ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts } } } } } }`);
  console.log('\nAll discounts:');
  (all?.data?.automaticDiscountNodes?.nodes || []).forEach(n => {
    const d = n.automaticDiscount;
    console.log(`  ${d.title} (${d.status}) productDiscounts=${d.combinesWith?.productDiscounts}`);
  });

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
