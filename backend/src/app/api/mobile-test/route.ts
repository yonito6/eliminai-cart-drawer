import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.search;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mobile Test</title>
</head>
<body style="margin:0;padding:20px;font-family:system-ui;background:#fafafa">
  <h2 style="color:#111;font-size:18px">Cart Optimizer - Mobile Test</h2>
  <div id="info" style="font-size:13px;color:#555;line-height:1.8"></div>
  <br>
  <a href="/dashboard${params}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
    Go to Dashboard
  </a>
  <script>
    var d = document.getElementById('info');
    var lines = [];
    lines.push('URL: ' + location.href);
    lines.push('In iframe: ' + (window !== window.top));
    lines.push('Screen: ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('UA: ' + navigator.userAgent.substring(0, 100));
    lines.push('Params: ' + location.search.substring(0, 200));
    try { lines.push('localStorage: ' + (typeof localStorage)); } catch(e) { lines.push('localStorage: BLOCKED - ' + e.message); }
    try { lines.push('shopify global: ' + (typeof window.shopify)); } catch(e) { lines.push('shopify: ERROR - ' + e.message); }
    d.innerHTML = lines.join('<br>');
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "frame-ancestors *;",
    },
  });
}
