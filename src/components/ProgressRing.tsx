interface ProgressRingProps {
  progress: number;  // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showPercent?: boolean;
}

export default function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color = '#00ff88',
  label,
  showPercent = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out',
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercent && (
          <span
            className="text-sm font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color }}
          >
            {Math.round(progress)}%
          </span>
        )}
        {label && (
          <span className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
