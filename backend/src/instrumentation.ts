export async function register() {
  // Self-triggering cron — runs inside the Next.js server process
  // Only runs on the server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const CRON_SECRET = process.env.CRON_SECRET;
    const HOST = process.env.HOST || process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';

    const triggerCron = async (path: string, label: string) => {
      try {
        const res = await fetch(`${HOST}${path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CRON_SECRET}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json().catch(() => ({}));
        console.log(`[cron] ${label}: ${res.status}`, JSON.stringify(data).slice(0, 200));
      } catch (err: any) {
        console.error(`[cron] ${label} failed:`, err.message);
      }
    }

    // Nightly cron — every 24 hours (evaluates experiments, aggregates, prunes)
    setInterval(() => triggerCron('/api/cron/nightly', 'nightly'), 24 * 60 * 60 * 1000);

    // Adaptive cron — every hour (high-traffic stores get real-time updates)
    setInterval(() => triggerCron('/api/cron/adaptive', 'adaptive'), 60 * 60 * 1000);

    // Run nightly once on startup (catches up if server was restarted)
    setTimeout(() => triggerCron('/api/cron/nightly', 'startup-nightly'), 10_000);

    console.log('[cron] Self-triggering cron registered: nightly (24h) + adaptive (1h)');
  }
}
