const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: { contains: 'eliminai-test' } },
    select: { id: true, shopDomain: true, accessToken: true, config: true, demoConfig: true },
  });
  if (!store) { console.log('No test store'); return; }

  console.log('=== TEST STORE CONFIG ===');
  const cfg = store.config || {};
  console.log('giftDiscountCodes:', JSON.stringify(cfg.giftDiscountCodes));
  
  const addons = cfg.addons || {};
  const bar = addons.freeShippingBar?.config || {};
  const tiers = bar.tiers || [];
  for (const t of tiers) {
    const gifts = t.giftProducts || [];
    console.log(`Tier goal=${t.goal} label="${t.label}": ${gifts.length} gifts [${gifts.map(g => g.handle + ' vid=' + g.variantId).join(', ')}]`);
  }

  console.log('\n=== ALL AUTOMATIC DISCOUNTS ===');
  const autoResult = await gql(store.shopDomain, store.accessToken, `{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerBuys { 
              value { ... on DiscountQuantity { quantity } }
              items { 
                ... on DiscountProducts { products(first: 5) { nodes { id title } } }
                ... on DiscountCollections { collections(first: 5) { nodes { id title } } }
              }
            }
            customerGets {
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
            }
            usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
          ... on DiscountAutomaticBasic {
            title status
            customerGets {
              value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
            }
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
    }
  }`);
  
  for (const n of (autoResult?.data?.automaticDiscountNodes?.nodes || [])) {
    const d = n.automaticDiscount;
    if (!d) continue;
    console.log(`\n  [AUTO] ${d.title} (${d.status}) — ${n.id}`);
    if (d.customerBuys) {
      const buysProducts = d.customerBuys.items?.products?.nodes?.map(p => p.title) || [];
      const buysCollections = d.customerBuys.items?.collections?.nodes?.map(c => c.title) || [];
      console.log(`    Buys: qty=${d.customerBuys.value?.quantity}, products=[${buysProducts.join(', ')}], collections=[${buysCollections.join(', ')}]`);
    }
    if (d.customerGets) {
      const getsProducts = d.customerGets.items?.products?.nodes?.map(p => p.title) || [];
      const qty = d.customerGets.value?.quantity?.quantity;
      const pct = d.customerGets.value?.quantity?.effect?.percentage || d.customerGets.value?.percentage;
      console.log(`    Gets: qty=${qty}, pct=${pct}, products=[${getsProducts.join(', ')}]`);
    }
    if (d.usesPerOrderLimit !== undefined) console.log(`    usesPerOrderLimit: ${d.usesPerOrderLimit}`);
    if (d.combinesWith) console.log(`    combinesWith: ${JSON.stringify(d.combinesWith)}`);
  }

  console.log('\n=== ALL CODE DISCOUNTS ===');
  const codeResult = await gql(store.shopDomain, store.accessToken, `{
    codeDiscountNodes(first: 50) {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBxgy {
            title status
            codes(first: 3) { nodes { code } }
            customerBuys { value { ... on DiscountQuantity { quantity } } }
            customerGets {
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
            }
            usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
          ... on DiscountCodeBasic {
            title status
            codes(first: 3) { nodes { code } }
            customerGets {
              value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
            }
            usageLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
    }
  }`);
  
  for (const n of (codeResult?.data?.codeDiscountNodes?.nodes || [])) {
    const d = n.codeDiscount;
    if (!d) continue;
    const codes = d.codes?.nodes?.map(c => c.code) || [];
    console.log(`\n  [CODE] ${d.title} (${d.status}) — codes: [${codes.join(', ')}] — ${n.id}`);
    if (d.customerBuys) {
      console.log(`    Buys: qty=${d.customerBuys.value?.quantity}`);
    }
    if (d.customerGets) {
      const getsProducts = d.customerGets.items?.products?.nodes?.map(p => p.title) || [];
      const qty = d.customerGets.value?.quantity?.quantity;
      const pct = d.customerGets.value?.quantity?.effect?.percentage || d.customerGets.value?.percentage;
      const amt = d.customerGets.value?.amount?.amount;
      console.log(`    Gets: qty=${qty}, pct=${pct}, amt=${amt}, products=[${getsProducts.join(', ')}]`);
    }
    if (d.usesPerOrderLimit !== undefined) console.log(`    usesPerOrderLimit: ${d.usesPerOrderLimit}`);
    if (d.usageLimit !== undefined) console.log(`    usageLimit: ${d.usageLimit}`);
    if (d.combinesWith) console.log(`    combinesWith: ${JSON.stringify(d.combinesWith)}`);
  }

  console.log('\n=== DEMO CONFIG ===');
  const demo = store.demoConfig || {};
  console.log('giftDiscountCodes:', JSON.stringify(demo.giftDiscountCodes));

  await p.$disconnect();
})();
