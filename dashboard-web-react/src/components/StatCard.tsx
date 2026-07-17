import type { ReactNode } from 'react';
import { Card } from './ChartCard';

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: 'var(--ink-muted)', fontSize: 12.5, fontWeight: 600 }}>{label}</p>
        {icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: accent ? `${accent}17` : 'var(--surface-sunken)',
              color: accent ?? 'var(--ink-faint)',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, fontFamily: 'var(--font-display)', color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </Card>
  );
}
