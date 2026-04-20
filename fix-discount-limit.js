const https = require('https');
const fs = require('fs');
const envContent = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };
const cid = getId('SHOPIFY_CLIENT_ID');
const csec = getId('SHOPIFY_CLIENT_SECRET');
const postData = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });

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

async function main() {
  const tokenRes = await doRequest('eleganto-3011.myshopify.com', '/admin/oauth/access_token', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
  const token = tokenRes.access_token;

  const body = JSON.stringify({ query: `
    mutation discountAutomaticBxgyUpdate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!, $id: ID!) {
      discountAutomaticBxgyUpdate(automaticBxgyDiscount: $automaticBxgyDiscount, id: $id) {
        automaticDiscountNode {
          id
          automaticDiscount { ... on DiscountAutomaticBxgy { title usesPerOrderLimit } }
        }
        userErrors { field message }
      }
    }
  `, variables: {
    id: 'gid://shopify/DiscountAutomaticNode/1622934880507',
    automaticBxgyDiscount: {
      usesPerOrderLimit: "1"
    }
  }});

  const res = await doRequest('eleganto-3011.myshopify.com', '/admin/api/2025-01/graphql.json', 'POST',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body);

  if (res.data?.discountAutomaticBxgyUpdate?.userErrors?.length > 0) {
    console.log('Error:', JSON.stringify(res.data.discountAutomaticBxgyUpdate.userErrors));
  } else if (res.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode) {
    const d = res.data.discountAutomaticBxgyUpdate.automaticDiscountNode.automaticDiscount;
    console.log('SUCCESS:', d.title, 'usesPerOrderLimit =', d.usesPerOrderLimit);
  } else {
    console.log('Response:', JSON.stringify(res).substring(0, 500));
  }
}
main().catch(e => console.error(e));
