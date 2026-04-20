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

function gql(token, query, variables) {
  const body = JSON.stringify({ query, variables });
  return doRequest('eleganto-3011.myshopify.com', '/admin/api/2025-01/graphql.json', 'POST',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body);
}

async function main() {
  const tokenRes = await doRequest('eleganto-3011.myshopify.com', '/admin/oauth/access_token', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
  const token = tokenRes.access_token;

  // === FIX 1: Set usesPerOrderLimit=1 on "1+1 FREE" ===
  console.log('=== FIX 1: Setting usesPerOrderLimit=1 on "1+1 FREE" ===');
  const discountId = 'gid://shopify/DiscountAutomaticNode/1622934880507';
  const updateResult = await gql(token, `
    mutation discountAutomaticBxgyUpdate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!, $id: ID!) {
      discountAutomaticBxgyUpdate(automaticBxgyDiscount: $automaticBxgyDiscount, id: $id) {
        automaticDiscountNode {
          id
          automaticDiscount { ... on DiscountAutomaticBxgy { title usesPerOrderLimit } }
        }
        userErrors { field message }
      }
    }
  `, {
    id: discountId,
    automaticBxgyDiscount: {
      usesPerOrderLimit: 1
    }
  });

  if (updateResult.data?.discountAutomaticBxgyUpdate?.userErrors?.length > 0) {
    console.log('Error:', JSON.stringify(updateResult.data.discountAutomaticBxgyUpdate.userErrors));
  } else if (updateResult.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode) {
    const d = updateResult.data.discountAutomaticBxgyUpdate.automaticDiscountNode.automaticDiscount;
    console.log('OK:', d.title, 'usesPerOrderLimit =', d.usesPerOrderLimit);
  } else {
    console.log('Unexpected:', JSON.stringify(updateResult).substring(0, 500));
  }

  // === FIX 2: Upload patched v14-complete.js to LIVE theme ===
  console.log('\n=== FIX 2: Uploading patched v14-complete.js to LIVE theme ===');
  const LIVE_THEME_ID = 145950245115;
  const code = fs.readFileSync('v14-complete.js', 'utf8');
  console.log('File size:', code.length);
  console.log('Has FREE_PRICE_LABEL:', code.includes('FREE_PRICE_LABEL'));
  console.log('Has FREE_PRICE_COLOR:', code.includes('FREE_PRICE_COLOR'));
  console.log('Has hasDiscount:', code.includes('hasDiscount'));
  console.log('Has #fff empty text:', code.includes('color: #fff !important; text-align: center'));

  const assetData = JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } });
  const res = await doRequest('eleganto-3011.myshopify.com',
    `/admin/api/2025-01/themes/${LIVE_THEME_ID}/assets.json`, 'PUT',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(assetData) },
    assetData);

  if (res.asset) {
    console.log('OK: Uploaded to LIVE theme:', res.asset.key, 'size=' + res.asset.size);
  } else {
    console.log('Error:', JSON.stringify(res).substring(0, 500));
  }

  // === VERIFY: Check both discounts ===
  console.log('\n=== VERIFY: Discount configuration ===');
  const verify = await gql(token, `{
    automaticDiscountNodes(first: 10) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
    }
  }`);

  if (verify.data?.automaticDiscountNodes) {
    for (const n of verify.data.automaticDiscountNodes.nodes) {
      const d = n.automaticDiscount;
      if (d.title && d.combinesWith) {
        console.log(`  "${d.title}" [${d.status}] limit=${d.usesPerOrderLimit} combines=${JSON.stringify(d.combinesWith)}`);
      }
    }
  }
}
main().catch(e => console.error(e));
