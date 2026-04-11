'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#ef4444', fontSize: 18, fontWeight: 600 }}>Dashboard Error</h2>
      <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 400, margin: '8px auto' }}>
        {error.message || 'Something went wrong loading the dashboard.'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          background: '#111827',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}
