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
    const body = variables ? { query, variables } : { query };
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // Delete the qty>=4 discount
  console.log('Deleting qty>=4 discount...');
  await gql(`mutation { discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787501674747") { deletedAutomaticDiscountId userErrors { message } } }`);

  // Create with subtotal >= $100 (cheapest watch is $129.99, so 1 watch wouldn't qualify but case alone at $49.99 won't)
  console.log('Creating with subtotal >= $100...');
  const res = await gql(`mutation discountAutomaticBasicCreate($d: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $d) {
      automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBasic { title status minimumRequirement { ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } } } } }
      userErrors { field message code }
    }
  }`, {
    d: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
      minimumRequirement: {
        subtotal: { greaterThanOrEqualToSubtotal: "100.00" }
      },
      customerGets: {
        value: { percentage: 1.0 },
        items: { products: { productsToAdd: ["gid://shopify/Product/8959501435131"] } }
      }
    }
  });
  
  if (res.data?.discountAutomaticBasicCreate?.userErrors?.length) {
    console.error('Errors:', JSON.stringify(res.data.discountAutomaticBasicCreate.userErrors));
  } else {
    console.log('Created:', JSON.stringify(res.data?.discountAutomaticBasicCreate?.automaticDiscountNode, null, 2));
  }

  await new Promise(r => setTimeout(r, 3000));
  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
