const https = require('https');
const fs = require('fs');

// Check discounts on both stores
const stores = [
  { name: 'Eleganto (production)', domain: 'eleganto-3011.myshopify.com', envFile: 'C:/יוני/אפליקציות/Eleganto AI customer support/app/.env' },
];

// Also try test store via its own credentials
const envContent = fs.readFileSync(stores[0].envFile, 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };

function getToken(domain, cid, csec) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });
    const req = https.request({
      hostname: domain, path: '/admin/oauth/access_token', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    }, res => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body).access_token); } catch(e) { reject(body); }
      });
    });
    req.write(postData); req.end();
  });
}

function queryDiscounts(domain, token) {
  return new Promise((resolve, reject) => {
    const query = JSON.stringify({ query: `{
      discountNodes(first: 20, query: "status:active") {
        nodes {
          id
          discount {
            ... on DiscountAutomaticBxgy {
              title
              status
              customerBuys {
                items { ... on AllDiscountItems { allItems } ... on DiscountProducts { productVariants(first: 5) { nodes { id title } } products(first: 5) { nodes { id title } } } ... on DiscountCollections { collections(first: 5) { nodes { id title } } } }
                value { ... on DiscountQuantity { quantity } }
              }
              customerGets {
                items { ... on AllDiscountItems { allItems } ... on DiscountProducts { productVariants(first: 5) { nodes { id title } } products(first: 5) { nodes { id title } } } ... on DiscountCollections { collections(first: 5) { nodes { id title } } } }
                value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
              }
              usesPerOrderLimit
              combinesWith { orderDiscounts productDiscounts shippingDiscounts }
            }
            ... on DiscountAutomaticBasic { title status }
            ... on DiscountCodeBxgy { title status }
            ... on DiscountCodeBasic { title status }
          }
        }
      }
    }` });
    const req = https.request({
      hostname: domain, path: '/admin/api/2025-01/graphql.json', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(query) }
    }, res => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(body); }
      });
    });
    req.write(query); req.end();
  });
}

async function main() {
  const cid = getId('SHOPIFY_CLIENT_ID');
  const csec = getId('SHOPIFY_CLIENT_SECRET');

  // Production store
  console.log('=== PRODUCTION (eleganto-3011) ===');
  const token1 = await getToken('eleganto-3011.myshopify.com', cid, csec);
  const result1 = await queryDiscounts('eleganto-3011.myshopify.com', token1);
  const bxgy1 = result1.data.discountNodes.nodes.filter(n => n.discount.customerBuys);
  bxgy1.forEach(d => {
    const disc = d.discount;
    console.log('\nDiscount:', disc.title, '(ID:', d.id, ')');
    console.log('  customerBuys quantity:', disc.customerBuys.value.quantity);
    console.log('  customerBuys items:', JSON.stringify(disc.customerBuys.items));
    console.log('  customerGets quantity:', disc.customerGets.value.quantity.quantity);
    console.log('  customerGets effect:', JSON.stringify(disc.customerGets.value.effect));
    console.log('  customerGets items:', JSON.stringify(disc.customerGets.items));
    console.log('  usesPerOrderLimit:', disc.usesPerOrderLimit);
    console.log('  combinesWith:', JSON.stringify(disc.combinesWith));
  });

  // Try test store with same credentials
  console.log('\n\n=== TEST STORE (eliminai-test) ===');
  try {
    const token2 = await getToken('eliminai-test.myshopify.com', cid, csec);
    if (token2) {
      const result2 = await queryDiscounts('eliminai-test.myshopify.com', token2);
      const bxgy2 = result2.data.discountNodes.nodes.filter(n => n.discount.customerBuys);
      bxgy2.forEach(d => {
        const disc = d.discount;
        console.log('\nDiscount:', disc.title, '(ID:', d.id, ')');
        console.log('  customerBuys quantity:', disc.customerBuys.value.quantity);
        console.log('  customerBuys items:', JSON.stringify(disc.customerBuys.items));
        console.log('  customerGets quantity:', disc.customerGets.value.quantity.quantity);
        console.log('  customerGets effect:', JSON.stringify(disc.customerGets.value.effect));
        console.log('  customerGets items:', JSON.stringify(disc.customerGets.items));
        console.log('  usesPerOrderLimit:', disc.usesPerOrderLimit);
        console.log('  combinesWith:', JSON.stringify(disc.combinesWith));
      });
    }
  } catch(e) {
    console.log('Test store access failed:', e);
  }
}

main().catch(e => console.error(e));
