import type { ReactNode, HTMLAttributes } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  highlight?: boolean;
}

export default function GlassCard({
  children,
  highlight = false,
  className = '',
  style,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={`glass-card ${className}`}
      style={{
        borderColor: highlight ? 'rgba(0, 255, 136, 0.4)' : undefined,
        boxShadow: highlight
          ? '0 8px 32px rgba(0,0,0,0.4), 0 0 40px rgba(0,255,136,0.08)'
          : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
