export const dynamic = 'force-dynamic';

export default function RootPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  // Log every request to root — check Railway logs to see if mobile even hits us
  console.log('[ROOT PAGE HIT]', JSON.stringify({
    time: new Date().toISOString(),
    params: searchParams,
  }));

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', background: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, color: '#111' }}>Cart Optimizer</h1>
      <p style={{ fontSize: 14, color: '#666' }}>
        If you can read this, the page loaded. v3 {new Date().toISOString().slice(11,19)}
      </p>
      <p style={{ fontSize: 12, color: '#999' }}>
        Params: {JSON.stringify(searchParams)}
      </p>
      <a href={'/dashboard' + (Object.keys(searchParams).length ? '?' + new URLSearchParams(searchParams as Record<string,string>).toString() : '')}
        style={{
          display: 'inline-block', marginTop: 16, padding: '12px 24px',
          background: '#111', color: '#fff', borderRadius: 8,
          textDecoration: 'none', fontWeight: 600,
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}
