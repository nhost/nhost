import {
  CircleAlert,
  CircleCheck,
  type LucideIcon,
  PauseCircle,
  PlayCircle,
  RotateCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

interface ProjectStatusStyle {
  label: string;
  icon: LucideIcon;
  /** Animation for in-progress states (on the icon, or the dot when compact). */
  motionClassName?: string;
  colorClassName: string;
}

const MUTED = 'border-muted-foreground/40 text-muted-foreground';

const PROJECT_STATUS_STYLES: Partial<
  Record<ApplicationStatus, ProjectStatusStyle>
> = {
  [ApplicationStatus.Live]: {
    label: 'Live',
    icon: CircleCheck,
    colorClassName: 'border-primary/40 text-primary',
  },
  [ApplicationStatus.Paused]: {
    label: 'Paused',
    icon: PauseCircle,
    colorClassName: MUTED,
  },
  [ApplicationStatus.Unpausing]: {
    label: 'Waking up',
    icon: PlayCircle,
    motionClassName: 'animate-blinking',
    colorClassName: MUTED,
  },
  [ApplicationStatus.Pausing]: {
    label: 'Pausing',
    icon: PauseCircle,
    motionClassName: 'animate-blinking',
    colorClassName: MUTED,
  },
  [ApplicationStatus.Restoring]: {
    label: 'Restoring',
    icon: RotateCw,
    motionClassName: 'animate-blinking',
    colorClassName: MUTED,
  },
  [ApplicationStatus.Errored]: {
    label: 'Error',
    icon: CircleAlert,
    colorClassName: 'border-destructive/40 text-destructive',
  },
};

export interface ProjectStatusPillProps {
  status?: ApplicationStatus;
  /**
   * `compact` is the small, icon-free version for tight spots like the
   * project dropdown. Both share the same colors and labels.
   *
   * @default 'default'
   */
  size?: 'default' | 'compact';
}

/**
 * A project's state (Live, Paused, Waking up…) as a pill. Renders nothing for
 * states without one.
 */
export default function ProjectStatusPill({
  status,
  size = 'default',
}: ProjectStatusPillProps) {
  const style =
    status === undefined ? undefined : PROJECT_STATUS_STYLES[status];

  if (!style) {
    return null;
  }

  const { label, icon: Icon, motionClassName, colorClassName } = style;

  if (size === 'compact') {
    return (
      <Badge
        variant="outline"
        className={cn('h-5 shrink-0 gap-1 px-1.5 text-2xs', colorClassName)}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full bg-current',
            motionClassName,
          )}
        />
        {label}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1',
        colorClassName,
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', motionClassName)} />
      <span className="whitespace-nowrap font-medium text-xs">{label}</span>
    </span>
  );
}
