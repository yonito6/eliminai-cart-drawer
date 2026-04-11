import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Shopify orders/create webhook handler.
 * Matches order back to visitor session via cart attributes,
 * then fires ORDER_COMPLETED event for Thompson Sampling.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify HMAC if secret is set
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret && hmacHeader) {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    if (computed !== hmacHeader) {
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
    }
  }

  let order: any;
  try {
    order = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Extract cart attributes stamped by our storefront script
  const attrs = order.note_attributes || [];
  const sessionToken = attrs.find((a: any) => a.name === '_eliminai_session')?.value;
  const variantId = attrs.find((a: any) => a.name === '_eliminai_variant')?.value;
  const experimentId = attrs.find((a: any) => a.name === '_eliminai_experiment')?.value;

  // Find the store from shop domain (webhook header)
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  // Primary path: match via cart attributes
  let session: any = null;
  if (sessionToken) {
    session = await prisma.visitorSession.findUnique({
      where: { sessionToken },
    });
  }

  // Fallback: if no cart attributes (express checkout, Buy Now, cleared cart),
  // try to find a recent session for this store that had a CHECKOUT_CLICKED
  // within the last 30 minutes — likely the same customer
  if (!session && shopDomain) {
    const store = await prisma.store.findUnique({ where: { shopDomain } });
    if (store) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentCheckout = await prisma.event.findFirst({
        where: {
          storeId: store.id,
          eventType: 'CHECKOUT_CLICKED',
          createdAt: { gte: thirtyMinAgo },
        },
        orderBy: { createdAt: 'desc' },
        include: { session: true },
      });
      if (recentCheckout?.session) {
        // Verify this session doesn't already have an ORDER_COMPLETED
        const alreadyOrdered = await prisma.event.findFirst({
          where: { sessionId: recentCheckout.sessionId, eventType: 'ORDER_COMPLETED' },
        });
        if (!alreadyOrdered) {
          session = recentCheckout.session;
        }
      }
    }
  }

  if (!session) {
    return NextResponse.json({ ok: true, matched: false, reason: sessionToken ? 'session_not_found' : 'no_attributes' });
  }

  // Check if ORDER_COMPLETED already recorded for this order (dedup)
  const existing = await prisma.event.findFirst({
    where: {
      sessionId: session.id,
      eventType: 'ORDER_COMPLETED',
      metadata: { path: ['shopifyOrderId'], equals: String(order.id) },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, matched: true, deduplicated: true });
  }

  // Find the variant assignment if we have experiment info
  let assignmentId: string | undefined;
  if (experimentId) {
    const assignment = await prisma.variantAssignment.findFirst({
      where: { sessionId: session.id, experimentId },
    });
    assignmentId = assignment?.id;
  }

  // Create ORDER_COMPLETED event
  await prisma.event.create({
    data: {
      sessionId: session.id,
      storeId: session.storeId,
      assignmentId: assignmentId || null,
      eventType: 'ORDER_COMPLETED',
      hourOfDay: new Date().getUTCHours(),
      dayOfWeek: new Date().getUTCDay(),
      metadata: {
        shopifyOrderId: String(order.id),
        orderNumber: order.order_number,
        totalPrice: order.total_price,
        currency: order.currency,
        variantId: variantId || null,
        experimentId: experimentId || null,
        itemCount: order.line_items?.length || 0,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    sessionId: session.id,
    experimentId: experimentId || null,
  });
}
