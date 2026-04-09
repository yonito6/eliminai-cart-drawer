import { describe, it, expect } from 'vitest';
import { verifyAppProxySignature } from '../lib/hmac';

describe('verifyAppProxySignature', () => {
  const secret = 'test_secret_123';

  it('returns true for valid signature', () => {
    const crypto = require('crypto');
    const params = { shop: 'test.myshopify.com', timestamp: '1712678400', path_prefix: '/apps/eliminai-cart' };
    const sorted = Object.keys(params).sort();
    const message = sorted.map(k => `${k}=${params[k as keyof typeof params]}`).join('');
    const sig = crypto.createHmac('sha256', secret).update(message).digest('hex');

    const query = { ...params, signature: sig };
    expect(verifyAppProxySignature(query, secret)).toBe(true);
  });

  it('returns false for tampered params', () => {
    const query = { shop: 'evil.myshopify.com', timestamp: '1712678400', path_prefix: '/apps/eliminai-cart', signature: 'fake_signature' };
    expect(verifyAppProxySignature(query, secret)).toBe(false);
  });

  it('returns false for missing signature', () => {
    const query = { shop: 'test.myshopify.com', timestamp: '1712678400' };
    expect(verifyAppProxySignature(query, secret)).toBe(false);
  });
});
