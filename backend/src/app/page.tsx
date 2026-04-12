import { redirect } from 'next/navigation';

export default function RootPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  // Build query string preserving Shopify params
  const keep = ['shop', 'host', 'hmac', 'timestamp', 'session', 'locale'];
  const params = new URLSearchParams();
  for (const k of keep) {
    if (searchParams[k]) params.set(k, searchParams[k]!);
  }
  const qs = params.toString();
  redirect(qs ? `/dashboard?${qs}` : '/dashboard');
}
