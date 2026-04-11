'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', fontSize: 18 }}>Something went wrong</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>{error.message}</p>
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
      </body>
    </html>
  );
}
