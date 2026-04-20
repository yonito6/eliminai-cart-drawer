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

  // Update existing discount to add minimum requirement
  // First delete, then recreate with min
  console.log('Deleting current discount...');
  await gql(`mutation { discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787501576443") { deletedAutomaticDiscountId userErrors { message } } }`);

  // Recreate with minimumRequirement quantity >= 3 using SUBTOTAL instead
  // The tier config says goal: 3 items. Let's use subtotal >= $1 (anything in cart besides the case)
  // Actually let me test: does quantity min count the discounted item itself?
  // Let's try quantity >= 4 (3 watches + 1 case = 4 items)
  console.log('Creating with quantity >= 4...');
  const res = await gql(`mutation discountAutomaticBasicCreate($d: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $d) {
      automaticDiscountNode { id }
      userErrors { field message code }
    }
  }`, {
    d: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
      minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: "4" } },
      customerGets: {
        value: { percentage: 1.0 },
        items: { products: { productsToAdd: ["gid://shopify/Product/8959501435131"] } }
      }
    }
  });
  
  if (res.data?.discountAutomaticBasicCreate?.userErrors?.length) {
    console.error('Errors:', JSON.stringify(res.data.discountAutomaticBasicCreate.userErrors));
  } else {
    console.log('Created with min 4:', res.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
  }

  await new Promise(r => setTimeout(r, 3000));
  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
