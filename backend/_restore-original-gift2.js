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

  // Step 1: Delete the Basic "Gift #2" I just created
  console.log('Step 1: Deleting Basic "Gift #2"...');
  const delRes = await gql(`mutation {
    discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787622359291") {
      deletedAutomaticDiscountId
      userErrors { field message }
    }
  }`);
  console.log('Deleted:', delRes?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId || 'error');

  // Step 2: Get ALL product IDs from "All Watch" collection (paginated)
  console.log('\nStep 2: Fetching all products from "All Watch" collection...');
  let allProducts = [];
  let cursor = null;
  let hasNext = true;

  while (hasNext) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const r = await gql(`{
      collection(id: "gid://shopify/Collection/432470327547") {
        products(first: 50${afterClause}) {
          nodes { id title status }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`);
    const prods = r?.data?.collection?.products;
    const nodes = prods?.nodes || [];
    // Only include ACTIVE products
    const active = nodes.filter(p => p.status === 'ACTIVE');
    allProducts = allProducts.concat(active);
    hasNext = prods?.pageInfo?.hasNextPage;
    cursor = prods?.pageInfo?.endCursor;
  }

  console.log('Found', allProducts.length, 'active products in "All Watch"');

  // Step 3: Recreate as BXGY with individual product IDs (original format)
  console.log('\nStep 3: Creating BXGY "Gift #2" with', allProducts.length, 'individual products...');
  const productIds = allProducts.map(p => p.id);

  const createRes = await gql(`mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
    discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerBuys {
              items {
                ... on DiscountProducts { products(first: 5) { nodes { title } } }
                ... on DiscountCollections { collections(first: 5) { nodes { title } } }
              }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items {
                ... on DiscountProducts { products(first: 5) { nodes { title } } }
              }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
            usesPerOrderLimit
          }
        }
      }
      userErrors { field code message }
    }
  }`, {
    automaticBxgyDiscount: {
      title: "Gift #2",
      startsAt: new Date().toISOString(),
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },
      usesPerOrderLimit: "1",
      customerBuys: {
        items: {
          products: {
            productsToAdd: productIds
          }
        },
        value: {
          quantity: "3"
        }
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        },
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: {
              percentage: 1.0
            }
          }
        }
      }
    }
  });

  if (createRes?.data?.discountAutomaticBxgyCreate?.userErrors?.length > 0) {
    console.error('Create errors:', JSON.stringify(createRes.data.discountAutomaticBxgyCreate.userErrors, null, 2));
  } else if (createRes?.errors) {
    console.error('GraphQL errors:', JSON.stringify(createRes.errors, null, 2));
  } else {
    const node = createRes?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode;
    console.log('Created! ID:', node?.id);
    const d = node?.automaticDiscount;
    console.log('Title:', d?.title, '| Status:', d?.status);
    console.log('Buy:', d?.customerBuys?.value?.quantity, 'from', d?.customerBuys?.items?.products?.nodes?.length || 0, 'products (showing first 5:', d?.customerBuys?.items?.products?.nodes?.map(p => p.title).join(', '), ')');
    console.log('Get:', d?.customerGets?.value?.quantity?.quantity, 'x', d?.customerGets?.items?.products?.nodes?.map(p => p.title).join(', '), '@ ', d?.customerGets?.value?.effect?.percentage * 100 + '% off');
    console.log('Uses per order:', d?.usesPerOrderLimit);
  }

  await p.$disconnect();
})();
