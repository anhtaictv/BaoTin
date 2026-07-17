import type { ReactNode } from 'react';

export function EmptyState({ icon, message, hint }: { icon?: ReactNode; message: string; hint?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--ink-muted)',
      }}
    >
      {icon && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface-sunken)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-faint)',
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ fontSize: 13, fontWeight: 500 }}>{message}</p>
      {hint && (
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', maxWidth: 280 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
