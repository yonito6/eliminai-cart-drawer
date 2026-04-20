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

  const backupThemes = [158546952443, 157790961915, 155894022395, 149132116219];

  for (const themeId of backupThemes) {
    try {
      const res = await doRequest('eleganto-3011.myshopify.com',
        '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=assets/v14-complete.js', 'GET',
        { 'X-Shopify-Access-Token': token }, null);

      if (res.asset) {
        const js = res.asset.value;
        const hasFPC = js.includes('FREE_PRICE_COLOR');
        const version = (js.match(/CCD v[\d.]+/) || ['unknown'])[0];
        console.log('Theme ' + themeId + ': size=' + js.length + ' version=' + version + ' hasNewChanges=' + hasFPC);

        if (hasFPC === false) {
          console.log('  -> Using this as restore source');
          const assetData = JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: js } });
          const restoreRes = await doRequest('eleganto-3011.myshopify.com',
            '/admin/api/2025-01/themes/145950245115/assets.json', 'PUT',
            { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(assetData) },
            assetData);
          if (restoreRes.asset) {
            console.log('  -> RESTORED live theme: size=' + restoreRes.asset.size);
          } else {
            console.log('  -> Restore error:', JSON.stringify(restoreRes));
          }
          return;
        }
      }
    } catch(e) {
      console.log('Theme ' + themeId + ': error');
    }
  }
  console.log('No backup found — all themes have new version or no v14-complete.js');
}
main().catch(e => console.error(e));
