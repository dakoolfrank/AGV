interface StatCardProps {
  label: string;
  value: string;
  className?: string;
}

export function StatCard({ label, value, className = '' }: StatCardProps) {
  return (
    <div className={`p-4 ${className}`}>
      <h3 className="text-white/80 text-sm font-semibold mb-2">{label}</h3>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}

