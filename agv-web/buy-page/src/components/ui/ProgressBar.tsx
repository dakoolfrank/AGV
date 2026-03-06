interface ProgressBarProps {
  percentage: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  barColor?: string;
  trackColor?: string;
}

export function ProgressBar({
  percentage,
  label,
  showPercentage = true,
  className = '',
  barColor = 'bg-primary',
  trackColor = 'bg-white/20'
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className={className}>
      {label && (
        <p className="text-white/80 text-sm mb-2">{label}</p>
      )}
      <div className={`w-full ${trackColor} rounded-full h-4 mb-2 overflow-hidden`}>
        <div
          className={`${barColor} h-4 rounded-full transition-all duration-1000 animate-progress-pulse`}
          style={{ width: `${clampedPercentage}%` }}
        ></div>
      </div>
      {showPercentage && (
        <p className="text-white/80 text-sm">
          {clampedPercentage.toFixed(2)}% Progress
        </p>
      )}
    </div>
  );
}

