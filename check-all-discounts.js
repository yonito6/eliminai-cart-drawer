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

  // Check ALL discounts — automatic AND code-based
  const body = JSON.stringify({ query: `{
    automaticDiscountNodes(first: 20) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy { title status usesPerOrderLimit combinesWith { productDiscounts } }
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticApp { title status }
        }
      }
    }
    codeDiscountNodes(first: 30) {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBasic { title status codes(first: 3) { nodes { code } } }
          ... on DiscountCodeBxgy { title status codes(first: 3) { nodes { code } } usesPerOrderLimit combinesWith { productDiscounts } }
          ... on DiscountCodeFreeShipping { title status codes(first: 3) { nodes { code } } }
        }
      }
    }
  }` });

  const res = await doRequest('eleganto-3011.myshopify.com', '/admin/api/2025-01/graphql.json', 'POST',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body);

  console.log('=== AUTOMATIC DISCOUNTS ===');
  if (res.data?.automaticDiscountNodes) {
    for (const n of res.data.automaticDiscountNodes.nodes) {
      const d = n.automaticDiscount;
      console.log(`  "${d.title}" [${d.status}] ID=${n.id} limit=${d.usesPerOrderLimit || 'none'} combines=${JSON.stringify(d.combinesWith || {})}`);
    }
  }

  console.log('\n=== CODE DISCOUNTS ===');
  if (res.data?.codeDiscountNodes) {
    for (const n of res.data.codeDiscountNodes.nodes) {
      const d = n.codeDiscount;
      const codes = d.codes?.nodes?.map(c => c.code).join(', ') || 'none';
      console.log(`  "${d.title}" [${d.status}] codes=[${codes}] ID=${n.id}`);
    }
  }

  if (res.errors) console.log('Errors:', JSON.stringify(res.errors));
}
main().catch(e => console.error(e));
