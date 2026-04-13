import { prisma } from './prisma';
import type { VisitorSegment } from '@prisma/client';

/**
 * Compute visitor segment based on their behavior history.
 * Priority: EXISTING_CUSTOMER > CHECKOUT_ABANDONER > RETURNING_BROWSER > NEW_VISITOR
 */
export async function computeSegment(
  sessionId: string,
  storeId: string,
  isReturning: boolean,
  hasCustomerId: boolean,
): Promise<VisitorSegment> {
  // If Shopify says they're a logged-in customer → EXISTING_CUSTOMER
  if (hasCustomerId) return 'EXISTING_CUSTOMER';

  // Check if this visitor has completed an order in ANY session (same store, same localStorage token prefix)
  const hasOrder = await prisma.event.findFirst({
    where: { sessionId, eventType: 'ORDER_COMPLETED' },
    select: { id: true },
  });
  if (hasOrder) return 'EXISTING_CUSTOMER';

  // Check for prior checkout activity (abandoned checkout)
  const hasCheckout = await prisma.event.findFirst({
    where: {
      sessionId,
      eventType: { in: ['CHECKOUT_CLICKED', 'CHECKOUT_STARTED'] },
    },
    select: { id: true },
  });
  if (hasCheckout) return 'CHECKOUT_ABANDONER';

  // Returning visitor (has localStorage marker from previous session)
  if (isReturning) return 'RETURNING_BROWSER';

  return 'NEW_VISITOR';
}

/**
 * Recompute and update segment for a session after an event.
 * Only upgrades — never downgrades (NEW → RETURNING → ABANDONER → CUSTOMER).
 */
export async function updateSessionSegment(
  sessionId: string,
  storeId: string,
  eventType?: string,
  hasCustomerId?: boolean,
): Promise<VisitorSegment> {
  const session = await prisma.visitorSession.findUnique({
    where: { id: sessionId },
    select: { isReturning: true, hasCustomerId: true, segment: true },
  });
  if (!session) return 'NEW_VISITOR';

  const custFlag = hasCustomerId ?? session.hasCustomerId;
  const newSegment = await computeSegment(sessionId, storeId, session.isReturning, custFlag);

  // Segment priority order for upgrade-only logic
  const priority: Record<string, number> = {
    NEW_VISITOR: 0,
    RETURNING_BROWSER: 1,
    CHECKOUT_ABANDONER: 2,
    EXISTING_CUSTOMER: 3,
  };

  // Only upgrade, never downgrade
  if (priority[newSegment] > priority[session.segment]) {
    await prisma.visitorSession.update({
      where: { id: sessionId },
      data: {
        segment: newSegment,
        ...(custFlag !== session.hasCustomerId ? { hasCustomerId: custFlag } : {}),
      },
    });
    return newSegment;
  }

  return session.segment;
}
