// Force dynamic rendering — never serve from cache
export const dynamic = 'force-dynamic';

export default function RootPage() {
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', background: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, color: '#111' }}>Cart Optimizer</h1>
      <p style={{ fontSize: 14, color: '#666' }}>If you can read this, the page loaded successfully.</p>
      <p style={{ fontSize: 12, color: '#999' }}>v2 — {new Date().toISOString()}</p>
      <a
        href="/dashboard"
        style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '12px 24px',
          background: '#111',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}
