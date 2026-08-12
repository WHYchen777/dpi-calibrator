import { useState, useEffect, useRef } from 'react';

interface CountUpNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CountUpNumber({
  value,
  duration = 500,
  decimals = 0,
  suffix = '',
  prefix = '',
  className = '',
  style,
}: CountUpNumberProps) {
  const [display, setDisplay] = useState(value);
  const [bouncing, setBouncing] = useState(false);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value === prevRef.current) return;
    setBouncing(true);
    const timer = setTimeout(() => setBouncing(false), 300);

    const from = prevRef.current;
    prevRef.current = value;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span
      className={`${className} ${bouncing ? 'count-bounce' : ''}`}
      style={{ fontFamily: "'JetBrains Mono', monospace", ...style }}
    >
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
