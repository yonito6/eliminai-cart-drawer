const fs = require('fs');
const https = require('https');

const code = fs.readFileSync('C:/Projects/eliminai-cart-drawer/v14-complete.js', 'utf8');
const STORE = 'eliminai-test.myshopify.com';
const TOKEN = process.env.ELIMINAI_TEST_TOKEN;
const THEMES = ['185993036089', '185992970553']; // main published, Horizon
const ASSET_KEY = 'assets/v14-complete.js';

if (!TOKEN) {
  console.error('ERROR: Set ELIMINAI_TEST_TOKEN env var');
  process.exit(1);
}

async function upload(themeId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ asset: { key: ASSET_KEY, value: code } });
    const req = https.request({
      hostname: STORE,
      path: `/admin/api/2025-01/themes/${themeId}/assets.json`,
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`Theme ${themeId}: UPLOADED (${(code.length/1024).toFixed(1)} KB)`);
          resolve();
        } else {
          console.log(`Theme ${themeId}: FAILED ${res.statusCode} — ${data.substring(0, 200)}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const t of THEMES) {
    await upload(t);
  }
  console.log('\nDone! Cart drawer should work now.');
})();
