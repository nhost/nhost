import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

interface ProjectStatusPillCompactStyle {
  dotClassName?: string;
  pillClassName: string;
  description: string;
}

// Same colors and copy as `ProjectStatusPill`, just swapped for the dropdown's
// tighter, icon-free layout. Keep this in sync with `ProjectStatusPill` by
// hand; it's a deliberate copy, not a shared component, so the roomier
// icon version elsewhere is never affected by dropdown-only sizing changes.
const PROJECT_STATUS_PILL_COMPACT_STYLES: Partial<
  Record<ApplicationStatus, ProjectStatusPillCompactStyle>
> = {
  [ApplicationStatus.Errored]: {
    pillClassName: 'border-destructive/40 text-destructive',
    description: 'Error',
  },
  [ApplicationStatus.Pausing]: {
    dotClassName: 'animate-blinking',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Pausing',
  },
  [ApplicationStatus.Restoring]: {
    // A spinning icon reads as "in progress"; a spinning dot looks
    // identical to a static one, so it blinks instead, same as the other
    // in-progress states.
    dotClassName: 'animate-blinking',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Restoring',
  },
  [ApplicationStatus.Paused]: {
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Paused',
  },
  [ApplicationStatus.Unpausing]: {
    dotClassName: 'animate-blinking',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Waking up',
  },
  [ApplicationStatus.Live]: {
    pillClassName: 'border-primary-main/40 text-primary-main',
    description: 'Live',
  },
};

export default function ProjectStatusPillCompact({
  status,
}: {
  status: ApplicationStatus;
}) {
  const style = PROJECT_STATUS_PILL_COMPACT_STYLES[status];

  if (!style) {
    return null;
  }

  const { dotClassName, pillClassName, description } = style;

  return (
    <Badge
      variant="outline"
      className={cn('h-5 gap-1 px-[6px] text-[10px]', pillClassName)}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current',
          dotClassName,
        )}
      />
      {description}
    </Badge>
  );
}
