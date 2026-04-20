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

  // First check ALL discounts and their current combinesWith
  const allRes = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
          ... on DiscountAutomaticBxgy {
            title
            status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
    }
  }`);
  console.log('=== ALL DISCOUNTS combinesWith ===');
  (allRes?.data?.automaticDiscountNodes?.nodes || []).forEach(n => {
    const d = n.automaticDiscount;
    console.log(`${d.title} (${d.status}): combines=${JSON.stringify(d.combinesWith)}`);
  });

  // Revert Watch Oganizer combinesWith back to original (all false — Shopify default for BxGy)
  console.log('\n--- Reverting Watch Oganizer combinesWith ---');
  const revert = await gql(`
    mutation discountAutomaticBxgyUpdate($id: ID!, $discount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    id: "gid://shopify/DiscountAutomaticNode/1632976961787",
    discount: {
      combinesWith: {
        productDiscounts: false,
        orderDiscounts: false,
        shippingDiscounts: false
      }
    }
  });
  const errors = revert?.data?.discountAutomaticBxgyUpdate?.userErrors;
  if (errors?.length > 0) {
    console.error('Errors:', errors);
  } else {
    console.log('Reverted:', JSON.stringify(revert?.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode?.automaticDiscount, null, 2));
  }

  // Also revert the other BxGy discounts that were likely modified
  const bxgyIds = [
    { id: 'gid://shopify/DiscountAutomaticNode/1588433027323', title: '1+2 FREE' },
    { id: 'gid://shopify/DiscountAutomaticNode/1622934880507', title: '1+1 FREE' },
  ];
  for (const disc of bxgyIds) {
    console.log(`\n--- Reverting ${disc.title} combinesWith ---`);
    const r = await gql(`
      mutation discountAutomaticBxgyUpdate($id: ID!, $discount: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $discount) {
          userErrors { field message }
          automaticDiscountNode {
            automaticDiscount {
              ... on DiscountAutomaticBxgy { title combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
            }
          }
        }
      }
    `, {
      id: disc.id,
      discount: {
        combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: false }
      }
    });
    const e2 = r?.data?.discountAutomaticBxgyUpdate?.userErrors;
    if (e2?.length > 0) console.error('Errors:', e2);
    else console.log('Reverted:', JSON.stringify(r?.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode?.automaticDiscount, null, 2));
  }

  // Also revert sun and moon (DiscountAutomaticBasic)
  console.log('\n--- Reverting sun and moon combinesWith ---');
  const smr = await gql(`
    mutation discountAutomaticBasicUpdate($id: ID!, $discount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
        userErrors { field message }
        automaticDiscountNode {
          automaticDiscount {
            ... on DiscountAutomaticBasic { title combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
          }
        }
      }
    }
  `, {
    id: "gid://shopify/DiscountAutomaticNode/1445180309755",
    discount: {
      combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: false }
    }
  });
  const e3 = smr?.data?.discountAutomaticBasicUpdate?.userErrors;
  if (e3?.length > 0) console.error('Errors:', e3);
  else console.log('Reverted:', JSON.stringify(smr?.data?.discountAutomaticBasicUpdate?.automaticDiscountNode?.automaticDiscount, null, 2));

  // Delete the new Eliminai Gift — Eleganto Case too since it wasn't there originally
  console.log('\n--- Deleting new Eliminai Gift discount ---');
  const delRes = await gql(`
    mutation discountAutomaticDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors { field message }
      }
    }
  `, { id: "gid://shopify/DiscountAutomaticNode/1787495317755" });
  console.log('Deleted:', delRes?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId || 'failed');

  // Final state
  console.log('\n=== FINAL STATE ===');
  const finalRes = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
          ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
        }
      }
    }
  }`);
  (finalRes?.data?.automaticDiscountNodes?.nodes || []).forEach(n => {
    const d = n.automaticDiscount;
    console.log(`${d.title} (${d.status}): combines=${JSON.stringify(d.combinesWith)}`);
  });

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
