import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';

export interface LastUsedBadgeProps {
  className?: string;
}

export function LastUsedBadge({ className }: LastUsedBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'pointer-events-none absolute -top-2.5 right-4 z-10 select-none rounded-full',
        'border border-blue-500/40 bg-[#0c2d6b] px-2.5 py-0.5',
        'font-bold text-[10px] text-blue-200 uppercase tracking-wider shadow-sm',
        className,
      )}
    >
      LAST USED
    </Badge>
  );
}

export default LastUsedBadge;
