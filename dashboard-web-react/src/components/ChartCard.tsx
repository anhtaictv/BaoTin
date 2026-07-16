import type { ReactNode } from 'react';

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 16,
};

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>;
}

export function ChartCardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Card style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Đang tải...
    </Card>
  );
}

export function ChartCardError({ onRetry, height = 220 }: { onRetry: () => void; height?: number }) {
  return (
    <Card style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <p>Không tải được dữ liệu.</p>
      <button onClick={onRetry}>Thử lại</button>
    </Card>
  );
}
