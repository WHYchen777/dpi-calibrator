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
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-10 py-4 text-base',
  };

  return (
    <button
      className={`glow-btn glow-btn--${variant} ${sizeClasses[size]} ${pulse ? 'animate-pulse-glow' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
