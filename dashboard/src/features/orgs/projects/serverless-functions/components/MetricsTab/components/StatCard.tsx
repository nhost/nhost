import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-2 rounded-lg border bg-card p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-2 text-muted-foreground text-sm">
        {Icon ? (
          <span className="flex h-5 shrink-0 items-center">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-3xl text-foreground tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="text-muted-foreground text-xs">{hint}</div>
      ) : null}
    </div>
  );
}
