const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };
const cid = getId('SHOPIFY_CLIENT_ID');
const csec = getId('SHOPIFY_CLIENT_SECRET');

const postData = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });

const tokenReq = https.request({
  hostname: 'eleganto-3011.myshopify.com',
  path: '/admin/oauth/access_token',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const token = JSON.parse(body).access_token;
    if (!token) { console.error('No token:', body); return; }

    // Query ALL automatic discounts (not just BXGY)
    const query = JSON.stringify({ query: `{
      automaticDiscountNodes(first: 20) {
        nodes {
          id
          automaticDiscount {
            __typename
            ... on DiscountAutomaticBxgy {
              title
              status
              startsAt
              endsAt
              customerBuys {
                value { ... on DiscountQuantity { quantity } }
              }
              customerGets {
                value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
              }
              usesPerOrderLimit
            }
            ... on DiscountAutomaticBasic {
              title
              status
              startsAt
              endsAt
            }
            ... on DiscountAutomaticApp {
              title
              status
              startsAt
              endsAt
            }
          }
        }
      }
    }` });

    const req = https.request({
      hostname: 'eleganto-3011.myshopify.com',
      path: '/admin/api/2025-01/graphql.json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(query) }
    }, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const result = JSON.parse(body2);
        console.log(JSON.stringify(result, null, 2));
      });
    });
    req.write(query);
    req.end();
  });
});
tokenReq.write(postData);
tokenReq.end();
