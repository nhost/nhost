import { cn } from '@/lib/utils';

interface StatusDotProps {
  active: boolean;
  className?: string;
}

/** Green when a setting is on, grey when it is off. */
export default function StatusDot({ active, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-2 w-2 shrink-0 rounded-full',
        active ? 'bg-success' : 'bg-muted-foreground/40',
        className,
      )}
    />
  );
}
