import type { ReactNode } from 'react';

/** Tinted badge (default) for status/urgency/trust chips — background is the color at low
 * opacity, text is the full color. `solid` fills the badge for high-emphasis cases (e.g. the
 * emergency flag) where a tint would be too quiet. */
export function Badge({ color, solid = false, children }: { color: string; solid?: boolean; children: ReactNode }) {
  return (
    <span
      className={`badge${solid ? ' badge-solid' : ''}`}
      style={solid ? { background: color } : { background: `${color}1f`, color }}
    >
      {children}
    </span>
  );
}
