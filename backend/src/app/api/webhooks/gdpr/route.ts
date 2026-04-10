import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Shopify mandatory GDPR webhooks.
 * Topics: customers/data_request, customers/redact, shop/redact
 *
 * We don't store customer PII (only anonymous session tokens),
 * so these are acknowledgement-only handlers.
 */

function verifyShopifyWebhook(body: string, hmac: string | null): boolean {
  if (!hmac || !process.env.SHOPIFY_API_SECRET) return false;
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const hmac = req.headers.get('x-shopify-hmac-sha256');
  const topic = req.headers.get('x-shopify-topic');

  if (!verifyShopifyWebhook(body, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  switch (topic) {
    case 'customers/data_request':
      // Customer requested their data. We only store anonymous session tokens — no PII to return.
      console.log('[gdpr] customers/data_request — no PII stored', payload.shop_domain);
      break;

    case 'customers/redact':
      // Customer requested deletion. No PII to delete.
      console.log('[gdpr] customers/redact — no PII stored', payload.shop_domain);
      break;

    case 'shop/redact':
      // Store uninstalled and requested full data deletion.
      // Delete all store data (sessions, events, experiments, etc.)
      console.log('[gdpr] shop/redact — cleaning up store data', payload.shop_domain);
      try {
        const { prisma } = await import('@/lib/prisma');
        const store = await prisma.store.findUnique({ where: { shopDomain: payload.shop_domain } });
        if (store) {
          await prisma.event.deleteMany({ where: { storeId: store.id } });
          await prisma.variantAssignment.deleteMany({ where: { storeId: store.id } });
          await prisma.visitorSession.deleteMany({ where: { storeId: store.id } });
          await prisma.dailySummary.deleteMany({ where: { storeId: store.id } });
          await prisma.experiment.deleteMany({ where: { storeId: store.id } });
          await prisma.store.delete({ where: { id: store.id } });
          console.log('[gdpr] shop/redact — deleted all data for', payload.shop_domain);
        }
      } catch (err: any) {
        console.error('[gdpr] shop/redact error:', err.message);
      }
      break;

    default:
      console.log('[gdpr] unknown topic:', topic);
  }

  return NextResponse.json({ success: true });
}
