const https = require('https');
const fs = require('fs');
const store = 'eleganto-3011.myshopify.com';
const STAGING_THEME = 158622155003;

function loadEnv() {
  var vars = {};
  try {
    var raw = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
    raw.split('\n').forEach(function(line) {
      var m = line.match(/^([A-Z_]+)=(.*)/);
      if (m) vars[m[1]] = m[2].replace(/^"|"$/g, '').trim();
    });
  } catch(e) {}
  return vars;
}

function getToken(cid, csec) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });
    var req = https.request({ hostname: store, path: '/admin/oauth/access_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        if (res.statusCode !== 200) { reject(new Error('OAuth: ' + res.statusCode)); return; }
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

function upload(token, key, value) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ asset: { key: key, value: value } });
    var req = https.request({ hostname: store, path: '/admin/api/2025-01/themes/' + STAGING_THEME + '/assets.json', method: 'PUT', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        console.log(key + ': ' + res.statusCode);
        if (res.statusCode !== 200) console.log(d.substring(0, 500));
        resolve();
      });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

(async function() {
  var env = loadEnv();
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

  // Read LIVE assets (downloaded earlier)
  var liveJs = fs.readFileSync('live-cart-drawer.js', 'utf8');
  var liveCss = fs.readFileSync('live-cart-drawer.css', 'utf8');

  // Only CSS change: add green color to "Free" label
  liveCss = liveCss.replace(
    '.ccd-item__price--free { font-weight: 700; }',
    '.ccd-item__price--free { font-weight: 700; color: #16a34a !important; }'
  );

  console.log('Uploading LIVE JS to STAGING (identical to live)...');
  console.log('JS: ' + liveJs.length + ' chars, CSS: ' + liveCss.length + ' chars');

  await upload(token, 'assets/custom-cart-drawer.js', liveJs);
  await upload(token, 'assets/custom-cart-drawer.css', liveCss);

  console.log('Done! Staging now matches LIVE exactly (+ green Free label color)');
})();
