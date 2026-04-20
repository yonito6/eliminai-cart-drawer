const https = require('https');
const fs = require('fs');

const store = 'eleganto-3011.myshopify.com';
const envContent = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };
const cid = getId('SHOPIFY_CLIENT_ID');
const csec = getId('SHOPIFY_CLIENT_SECRET');

const postData = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });

const tokenReq = https.request({
  hostname: store,
  path: '/admin/oauth/access_token',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const token = JSON.parse(body).access_token;
    if (!token) { console.error('No token:', body); return; }
    console.log('Token obtained');

    const query = `mutation {
      discountAutomaticBxgyUpdate(
        id: "gid://shopify/DiscountAutomaticNode/1787605647611"
        automaticBxgyDiscount: {
          customerBuys: {
            value: { quantity: "1" }
          }
        }
      ) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title
              customerBuys { value { ... on DiscountQuantity { quantity } } }
              customerGets { value { ... on DiscountOnQuantity { quantity { quantity } } } }
            }
          }
        }
        userErrors { field message }
      }
    }`;

    const mutation = JSON.stringify({ query });
    const gqlReq = https.request({
      hostname: store,
      path: '/admin/api/2025-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(mutation)
      }
    }, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const result = JSON.parse(body2);
        console.log(JSON.stringify(result, null, 2));
        if (result.data?.discountAutomaticBxgyUpdate?.userErrors?.length) {
          console.error('ERRORS:', result.data.discountAutomaticBxgyUpdate.userErrors);
        } else if (result.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode) {
          const disc = result.data.discountAutomaticBxgyUpdate.automaticDiscountNode.automaticDiscount;
          console.log('\nSUCCESS: Updated "' + disc.title + '"');
          console.log('  customerBuys quantity:', disc.customerBuys.value.quantity);
          console.log('  customerGets quantity:', disc.customerGets.value.quantity);
        }
      });
    });
    gqlReq.write(mutation);
    gqlReq.end();
  });
});
tokenReq.write(postData);
tokenReq.end();
