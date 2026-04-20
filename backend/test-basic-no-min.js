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

  // Delete current Basic discount
  console.log('Deleting current Basic discount...');
  await gql(`mutation { discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787500134651") { deletedAutomaticDiscountId userErrors { message } } }`);

  // Create with NO minimum requirement
  console.log('Creating Basic discount with NO minimum...');
  const res = await gql(`mutation discountAutomaticBasicCreate($d: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $d) {
      automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBasic { title status } } }
      userErrors { field message code }
    }
  }`, {
    d: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
      customerGets: {
        value: { percentage: 1.0 },
        items: { products: { productsToAdd: ["gid://shopify/Product/8959501435131"] } }
      }
    }
  });
  
  if (res.data?.discountAutomaticBasicCreate?.userErrors?.length) {
    console.error('Errors:', JSON.stringify(res.data.discountAutomaticBasicCreate.userErrors));
  } else {
    console.log('Created:', JSON.stringify(res.data?.discountAutomaticBasicCreate?.automaticDiscountNode));
  }

  // Wait 5 seconds for propagation
  console.log('Waiting 5 seconds for propagation...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Verify
  const verify = await gql(`{ automaticDiscountNodes(first: 50) { nodes { id automaticDiscount { ... on DiscountAutomaticBasic { title status } ... on DiscountAutomaticBxgy { title status } } } } }`);
  verify.data?.automaticDiscountNodes?.nodes?.forEach(n => {
    console.log('  ' + n.automaticDiscount.title + ' | ' + n.automaticDiscount.status);
  });

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
