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

  if (!sessionToken) {
    // Order not from our cart drawer — skip silently
    return NextResponse.json({ ok: true, matched: false });
  }

  // Find the visitor session
  const session = await prisma.visitorSession.findUnique({
    where: { sessionToken },
  });

  if (!session) {
    return NextResponse.json({ ok: true, matched: false, reason: 'session_not_found' });
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
