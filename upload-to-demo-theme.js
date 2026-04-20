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

  // Read the patched v14-complete.js
  const code = fs.readFileSync('v14-complete.js', 'utf8');
  console.log('Patched JS size:', code.length);
  console.log('Has FREE_PRICE_COLOR:', code.includes('FREE_PRICE_COLOR'));
  console.log('Has FREE_PRICE_LABEL:', code.includes('FREE_PRICE_LABEL'));
  console.log('Has hasDiscount:', code.includes('hasDiscount'));
  console.log('Has #fff empty cart:', code.includes('color: #fff !important; text-align: center'));

  // Upload to DEMO theme (158622155003) as assets/v14-complete.js
  const DEMO_THEME_ID = 158622155003;
  const assetData = JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } });
  const res = await doRequest('eleganto-3011.myshopify.com',
    `/admin/api/2025-01/themes/${DEMO_THEME_ID}/assets.json`, 'PUT',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(assetData) },
    assetData);

  if (res.asset) {
    console.log('\nUploaded to DEMO theme:', res.asset.key, 'size=' + res.asset.size);
  } else {
    console.log('\nError:', JSON.stringify(res));
  }
}
main().catch(e => console.error(e));
