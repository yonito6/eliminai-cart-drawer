/**
 * BLAST RADIUS MAP — Task 12: Shopify OAuth Install Flow
 * Target: NEW FILES — shopify-auth.ts, install/route.ts, callback/route.ts
 *
 * CALLERS:
 *   - install/route.ts calls buildInstallUrl
 *   - callback/route.ts calls exchangeToken + verifyHmac
 *   - No existing code calls these (brand new)
 *
 * DUPLICATED LOGIC:
 *   - hmac.ts has verifyAppProxySignature (App Proxy, joins with '' empty string)
 *   - shopify-auth.ts has verifyHmac (OAuth callback, joins with '&')
 *   - These are DIFFERENT Shopify mechanisms — must NOT share implementation
 *
 * SHARED STATE:
 *   - Writes: Store table (shopDomain, accessToken, shopName, currency, config, isActive)
 *   - Schema confirmed in prisma/schema.prisma — all fields exist
 *
 * CROSS-PATH RISK:
 *   - verifyHmac ('&' separator) must NOT accidentally use empty-string separator like App Proxy
 *   - App Proxy tests in hmac.test.ts must continue passing (no changes to hmac.ts)
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { buildInstallUrl, verifyHmac } from '../lib/shopify-auth';

const TEST_API_KEY = 'test_api_key_123';
const TEST_SECRET = 'test_api_secret_456';
const TEST_SCOPES = 'read_orders,write_orders';
const TEST_HOST = 'https://test.eliminai.ai';

// Set env vars before tests
process.env.SHOPIFY_API_KEY = TEST_API_KEY;
process.env.SHOPIFY_API_SECRET = TEST_SECRET;
process.env.SHOPIFY_SCOPES = TEST_SCOPES;
process.env.HOST = TEST_HOST;

// Helper: build a valid OAuth callback HMAC
function buildValidHmac(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHmac('sha256', TEST_SECRET).update(sorted).digest('hex');
}

describe('buildInstallUrl', () => {
  it('returns a valid Shopify OAuth authorization URL', () => {
    const url = buildInstallUrl('test-store.myshopify.com');
    expect(url).toContain('https://test-store.myshopify.com/admin/oauth/authorize');
    expect(url).toContain(`client_id=${TEST_API_KEY}`);
    expect(url).toContain(`scope=${encodeURIComponent(TEST_SCOPES)}`);
    expect(url).toContain(encodeURIComponent(`${TEST_HOST}/api/auth/callback`));
    expect(url).toContain('state=');
  });

  it('generates a different nonce on each call (prevents replay)', () => {
    const url1 = buildInstallUrl('test-store.myshopify.com');
    const url2 = buildInstallUrl('test-store.myshopify.com');
    const state1 = new URL(url1).searchParams.get('state');
    const state2 = new URL(url2).searchParams.get('state');
    expect(state1).not.toBe(state2);
  });

  it('uses the shop domain in the URL', () => {
    const url = buildInstallUrl('another-shop.myshopify.com');
    expect(url).toContain('another-shop.myshopify.com');
    expect(url).not.toContain('test-store.myshopify.com');
  });
});

describe('verifyHmac', () => {
  it('returns true for a valid OAuth callback HMAC', () => {
    const params = {
      code: 'abc123',
      shop: 'test-store.myshopify.com',
      state: 'random_nonce',
      timestamp: '1712678400',
    };
    const hmac = buildValidHmac(params);
    expect(verifyHmac({ ...params, hmac })).toBe(true);
  });

  it('returns false for a tampered shop param', () => {
    const params = {
      code: 'abc123',
      shop: 'test-store.myshopify.com',
      state: 'random_nonce',
      timestamp: '1712678400',
    };
    const hmac = buildValidHmac(params);
    // Tamper with the shop after signing
    expect(verifyHmac({ ...params, shop: 'evil.myshopify.com', hmac })).toBe(false);
  });

  it('returns false for a missing hmac', () => {
    const params = {
      code: 'abc123',
      shop: 'test-store.myshopify.com',
      state: 'random_nonce',
      timestamp: '1712678400',
    };
    expect(verifyHmac(params)).toBe(false);
  });

  it('returns false for a completely wrong hmac', () => {
    const params = {
      code: 'abc123',
      shop: 'test-store.myshopify.com',
      state: 'random_nonce',
      timestamp: '1712678400',
      hmac: 'completely_wrong_value_aabbccddeeff00112233445566778899aabbccddeeff0011',
    };
    expect(verifyHmac(params)).toBe(false);
  });

  it('LOCK: uses & separator (OAuth), NOT empty string (App Proxy) — must differ from hmac.ts behavior', () => {
    // Prove that the two HMAC implementations use different join strategies
    // App Proxy: join with '' (empty string)
    // OAuth callback: join with '&'
    const params = { code: 'abc', shop: 'test.myshopify.com', timestamp: '1000' };

    // Manually build App-Proxy-style HMAC (empty string join)
    const appProxyStyle = Object.keys(params).sort().map(k => `${k}=${params[k as keyof typeof params]}`).join('');
    const appProxyHmac = crypto.createHmac('sha256', TEST_SECRET).update(appProxyStyle).digest('hex');

    // Manually build OAuth-style HMAC (& join)
    const oauthStyle = Object.keys(params).sort().map(k => `${k}=${params[k as keyof typeof params]}`).join('&');
    const oauthHmac = crypto.createHmac('sha256', TEST_SECRET).update(oauthStyle).digest('hex');

    // The two styles produce different digests (they should never be confused)
    expect(appProxyHmac).not.toBe(oauthHmac);

    // verifyHmac MUST accept the OAuth-style HMAC, NOT the App-Proxy-style HMAC
    expect(verifyHmac({ ...params, hmac: oauthHmac })).toBe(true);
    expect(verifyHmac({ ...params, hmac: appProxyHmac })).toBe(false);
  });

  it('excludes hmac param from signature computation', () => {
    const params = {
      code: 'abc123',
      shop: 'test-store.myshopify.com',
      timestamp: '1712678400',
    };
    const hmac = buildValidHmac(params);

    // With hmac included in the query object, it should still verify correctly
    // because verifyHmac destructures { hmac, ...rest } before computing
    expect(verifyHmac({ ...params, hmac })).toBe(true);
  });
});
