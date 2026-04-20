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

  const variants = [
    'gid://shopify/ProductVariant/45167742681339',
    'gid://shopify/ProductVariant/45175479304443',
    'gid://shopify/ProductVariant/45167917367547'
  ];
  const caseVariant = 'gid://shopify/ProductVariant/46941745742075';
  const lineItems = [...variants.map(v => ({ variantId: v, quantity: 1 })), { variantId: caseVariant, quantity: 1 }];

  const draftRes = await gql(`mutation draftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        lineItems {
          title
          quantity
          originalTotalSet { shopMoney { amount } }
          discountedTotalSet { shopMoney { amount } }
          appliedDiscount { title value valueType description }
        }
      }
      userErrors { field message }
    }
  }`, { input: { lineItems } });

  const calc = draftRes?.data?.draftOrderCalculate;
  if (calc?.userErrors?.length > 0) {
    console.error('Errors:', JSON.stringify(calc.userErrors, null, 2));
  }
  const order = calc?.calculatedDraftOrder;
  if (order) {
    console.log('Subtotal:', order.subtotalPriceSet?.shopMoney?.amount);
    console.log('Total:', order.totalPriceSet?.shopMoney?.amount);
    console.log('\nLine items:');
    order.lineItems?.forEach(li => {
      const orig = li.originalTotalSet?.shopMoney?.amount;
      const disc = li.discountedTotalSet?.shopMoney?.amount;
      const discountInfo = li.appliedDiscount ? ` | DISCOUNT: ${li.appliedDiscount.title} (${li.appliedDiscount.value} ${li.appliedDiscount.valueType})` : '';
      console.log(`  ${li.title} x${li.quantity} | $${orig} → $${disc}${discountInfo}`);
    });
  } else {
    console.log('Response:', JSON.stringify(draftRes, null, 2));
  }

  await p.$disconnect();
})();
