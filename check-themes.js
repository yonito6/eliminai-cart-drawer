const https = require('https');
const fs = require('fs');
const store = 'eleganto-3011.myshopify.com';

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

(async function() {
  var env = loadEnv();
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

  // List all themes
  var req = https.request({ hostname: store, path: '/admin/api/2025-01/themes.json', method: 'GET', headers: { 'X-Shopify-Access-Token': token } }, function(res) {
    var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
      var themes = JSON.parse(d).themes;
      themes.forEach(function(t) {
        var label = '';
        if (t.id === 158577557755) label = ' ← LIVE THEME';
        if (t.id === 158622155003) label = ' ← STAGING/DEMO THEME';
        console.log('ID: ' + t.id + ' | Name: "' + t.name + '" | Role: ' + t.role + ' | Theme Store: ' + (t.theme_store_id || 'custom') + label);
      });
    });
  }); req.end();
})();
