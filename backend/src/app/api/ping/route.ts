import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse(
    '<html><body style="margin:0;padding:40px;font-family:system-ui;background:#fff"><h1>PING OK</h1><p>Time: ' + new Date().toISOString() + '</p></body></html>',
    {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    }
  );
}
