import crypto from 'crypto';

export function verifyAppProxySignature(
  query: Record<string, string>,
  secret: string
): boolean {
  const { signature, ...params } = query;
  if (!signature) return false;

  const sortedKeys = Object.keys(params).sort();
  const message = sortedKeys.map(key => `${key}=${params[key]}`).join('');

  const computed = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}
