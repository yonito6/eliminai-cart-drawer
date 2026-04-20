const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query, variables) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  };

  // Step 1: Delete old automatic "Gift #2" discount (can't combine with BXGY)
  console.log('Step 1: Deleting automatic Gift #2...');
  const delRes = await gql(`mutation {
    discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787625341179") {
      deletedAutomaticDiscountId
      userErrors { field message }
    }
  }`);
  console.log('Deleted:', delRes?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId || 'already gone');

  // Step 2: Create a discount code — 100% off Eleganto Case, auto-applied
  // Using discountCodeBasicCreate — hidden code the cart drawer applies automatically
  console.log('\nStep 2: Creating discount code FREECASE...');
  const createRes = await gql(`mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title
            status
            codes(first: 5) { nodes { code } }
            customerGets {
              items { ... on DiscountProducts { products(first: 5) { nodes { title } } } }
              value { ... on DiscountPercentage { percentage } }
            }
          }
        }
      }
      userErrors { field message code }
    }
  }`, {
    basicCodeDiscount: {
      title: "Gift #2",
      code: "FREECASE",
      startsAt: new Date().toISOString(),
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },
      usageLimit: null,
      customerGets: {
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        },
        value: {
          percentage: 1.0
        }
      },
      customerSelection: {
        all: true
      }
    }
  });

  if (createRes?.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
    console.error('Errors:', JSON.stringify(createRes.data.discountCodeBasicCreate.userErrors, null, 2));
  } else if (createRes?.errors) {
    console.error('GraphQL errors:', JSON.stringify(createRes.errors, null, 2));
  } else {
    const node = createRes?.data?.discountCodeBasicCreate?.codeDiscountNode;
    const d = node?.codeDiscount;
    console.log('Created! ID:', node?.id);
    console.log('Title:', d?.title, '| Status:', d?.status);
    console.log('Code:', d?.codes?.nodes?.[0]?.code);
    console.log('Products:', d?.customerGets?.items?.products?.nodes?.map(p => p.title).join(', '));
    console.log('Percentage:', d?.customerGets?.value?.percentage);
  }

  await p.$disconnect();
})();
