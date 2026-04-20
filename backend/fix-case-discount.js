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

  // Step 1: Delete the broken BxGy "Eliminai Gift — Eleganto Case"
  console.log('Step 1: Deleting broken BxGy discount...');
  const delRes = await gql(`mutation {
    discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787498004731") {
      deletedAutomaticDiscountId
      userErrors { field message }
    }
  }`);
  console.log('Delete result:', JSON.stringify(delRes.data?.discountAutomaticDelete));

  // Step 2: Create a DiscountAutomaticBasic — 100% off Eleganto Case when cart has 3+ items
  console.log('\nStep 2: Creating Basic discount...');
  const createRes = await gql(`mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
      userErrors { field message code }
    }
  }`, {
    automaticBasicDiscount: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity: "3"
        }
      },
      customerGets: {
        value: {
          percentage: 1.0
        },
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        }
      }
    }
  });
  
  if (createRes.errors) {
    console.error('GQL errors:', JSON.stringify(createRes.errors, null, 2));
  }
  if (createRes.data?.discountAutomaticBasicCreate?.userErrors?.length) {
    console.error('User errors:', JSON.stringify(createRes.data.discountAutomaticBasicCreate.userErrors, null, 2));
  } else {
    console.log('Created:', JSON.stringify(createRes.data?.discountAutomaticBasicCreate?.automaticDiscountNode, null, 2));
  }

  // Step 3: Verify all discounts
  console.log('\nStep 3: Verify all discounts...');
  const verifyRes = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticBxgy { title status }
        }
      }
    }
  }`);
  const nodes = verifyRes.data?.automaticDiscountNodes?.nodes || [];
  nodes.forEach(n => {
    console.log('  ' + n.automaticDiscount.title + ' (' + n.automaticDiscount.status + ') — ' + n.id);
  });

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
