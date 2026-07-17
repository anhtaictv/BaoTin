import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-xs)',
  padding: 16,
};

export function Card({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {children}
    </div>
  );
}

export function ChartCardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Card style={{ height, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
      <div className="skeleton" style={{ height: 12, width: '40%' }} />
      <div className="skeleton" style={{ height: Math.max(height - 64, 40), width: '100%' }} />
    </Card>
  );
}

export function ChartCardError({ onRetry, height = 220 }: { onRetry: () => void; height?: number }) {
  return (
    <Card style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Không tải được dữ liệu.</p>
      <button className="btn-sm" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <RotateCcw size={14} /> Thử lại
      </button>
    </Card>
  );
}
