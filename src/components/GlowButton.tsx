import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'accent' | 'purple' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export default function GlowButton({
  children,
  variant = 'accent',
  size = 'md',
  pulse = false,
  className = '',
  ...props
}: GlowButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-10 py-4 text-lg',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    accent: {
      borderColor: 'rgba(0,255,136,0.5)',
      color: '#00ff88',
    },
    purple: {
      borderColor: 'rgba(124,58,237,0.5)',
      color: '#7c3aed',
    },
    outline: {
      borderColor: 'rgba(255,255,255,0.2)',
      color: '#e0e0e0',
    },
  };

  return (
    <button
      className={`glow-btn ${sizeClasses[size]} ${pulse ? 'animate-pulse-glow' : ''} ${className}`}
      style={variantStyles[variant]}
      {...props}
    >
      {children}
    </button>
  );
}
