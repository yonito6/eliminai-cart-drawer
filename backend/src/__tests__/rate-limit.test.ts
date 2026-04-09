/**
 * BLAST RADIUS MAP — Rate Limiter (new feature)
 * Target: RateLimiter class in backend/src/lib/rate-limit.ts (new file)
 *
 * CALLERS:
 *   - None yet (Task 8 event endpoint will import sessionLimiter + storeLimiter)
 *
 * DUPLICATED LOGIC:
 *   - None — first rate limiting implementation in this project
 *
 * SHARED STATE:
 *   - In-memory Map per RateLimiter instance only
 *   - No DB writes, no cross-file state
 *
 * CROSS-PATH RISK:
 *   - Zero — pure new code, no existing paths affected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../lib/rate-limit';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
  });

  it('allows requests under limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('key1')).toBe(true);
    }
  });

  it('blocks requests over limit', () => {
    for (let i = 0; i < 5; i++) limiter.check('key1');
    expect(limiter.check('key1')).toBe(false);
  });

  it('tracks keys independently', () => {
    for (let i = 0; i < 5; i++) limiter.check('key1');
    expect(limiter.check('key2')).toBe(true);
  });
});
