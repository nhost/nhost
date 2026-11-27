import { Clock, Pause } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CronJobListItemProps {
  href: string;
  name: string;
  schedule: string;
  selected: boolean;
  paused?: boolean;
  onNavigate: VoidFunction;
}

export default function CronJobListItem({
  href,
  name,
  schedule,
  selected,
  paused,
  onNavigate,
}: CronJobListItemProps) {
  return (
    <div className="pb-1">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={selected ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-md p-2.5 text-left hover:bg-accent',
          selected && 'bg-table-selected',
        )}
      >
        <span
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            selected && 'text-primary',
            paused && !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate font-medium text-sm+">{name}</span>
          <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
            <Clock aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{schedule}</span>
          </span>
        </span>
        {paused && (
          <Pause
            role="img"
            aria-label="Paused"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
      </Link>
    </div>
  );
}
