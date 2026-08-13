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
      className={`glass-card ${highlight ? 'glass-card--highlight' : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
