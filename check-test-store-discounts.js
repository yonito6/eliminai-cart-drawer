const https = require('https');
const fs = require('fs');
const envContent = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };

// Test store credentials
const testEnvContent = fs.readFileSync('C:/Projects/eliminai-cart-drawer/backend/.env', 'utf8');
const getTestId = (key) => { const m = testEnvContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };

// Check both stores for discount setup
function doRequest(hostname, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, res => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(data); } });
    });
    if (body) req.write(body);
    req.end();
  });
}

async function checkDiscounts(store, clientId, clientSecret) {
  const postData = JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const tokenRes = await doRequest(store, '/admin/oauth/access_token', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
  const token = tokenRes.access_token;
  
  // GraphQL query for automatic discounts
  const query = JSON.stringify({ query: `{
    automaticDiscountNodes(first: 20) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys { value { ... on DiscountQuantity { quantity } } items { ... on AllDiscountItems { allItems } ... on DiscountProducts { productVariants(first: 5) { nodes { id } } products(first: 10) { nodes { id title } } } } }
            customerGets { value { ... on DiscountOnQuantity { quantity effect { ... on DiscountPercentage { percentage } } } } items { ... on AllDiscountItems { allItems } ... on DiscountProducts { productVariants(first: 5) { nodes { id } } products(first: 10) { nodes { id title } } } } }
            usesPerOrderLimit
          }
          ... on DiscountAutomaticBasic {
            title
            status
          }
          ... on DiscountAutomaticApp {
            title
            status
          }
        }
      }
    }
  }` });

  const res = await doRequest(store, '/admin/api/2025-01/graphql.json', 'POST',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, query);
  
  console.log(`\n=== ${store} DISCOUNTS ===`);
  if (res.data && res.data.automaticDiscountNodes) {
    for (const node of res.data.automaticDiscountNodes.nodes) {
      const d = node.automaticDiscount;
      if (d.customerBuys) {
        console.log(`\n${d.title} (${d.status})`);
        console.log('  ID:', node.id);
        console.log('  combinesWith:', JSON.stringify(d.combinesWith));
        console.log('  customerBuys qty:', d.customerBuys.value?.quantity);
        console.log('  customerBuys items:', d.customerBuys.items?.allItems ? 'ALL' : d.customerBuys.items?.products?.nodes?.map(p => p.title).join(', '));
        console.log('  customerGets qty:', d.customerGets.value?.quantity);
        console.log('  customerGets effect:', d.customerGets.value?.effect?.percentage ? (d.customerGets.value.effect.percentage * 100) + '% off' : 'unknown');
        console.log('  customerGets items:', d.customerGets.items?.allItems ? 'ALL' : d.customerGets.items?.products?.nodes?.map(p => p.title).join(', '));
        console.log('  usesPerOrderLimit:', d.usesPerOrderLimit);
      } else {
        console.log(`\n${d.title} (${d.status}) - type: ${d.__typename || 'Basic/App'}`);
        console.log('  ID:', node.id);
      }
    }
  } else {
    console.log('Error:', JSON.stringify(res));
  }
}

async function main() {
  const cid = getId('SHOPIFY_CLIENT_ID');
  const csec = getId('SHOPIFY_CLIENT_SECRET');
  
  // Main store
  await checkDiscounts('eleganto-3011.myshopify.com', cid, csec);
  
  // Test store - check if we have separate credentials
  const testCid = getTestId('SHOPIFY_CLIENT_ID');
  const testCsec = getTestId('SHOPIFY_CLIENT_SECRET');
  if (testCid && testCsec) {
    await checkDiscounts('aisupportshop.myshopify.com', testCid, testCsec);
  } else {
    console.log('\nNo test store credentials in backend/.env');
  }
}
main().catch(e => console.error(e));
