import {
  CircleAlert,
  CircleCheck,
  PauseCircle,
  PlayCircle,
  RotateCw,
  type LucideIcon,
} from 'lucide-react';
import { ApplicationStatus } from '@/types/application';

interface ProjectStatusPillStyle {
  icon: LucideIcon;
  iconClassName?: string;
  pillClassName: string;
  description: string;
}

const PROJECT_STATUS_PILL_STYLES: Partial<
  Record<ApplicationStatus, ProjectStatusPillStyle>
> = {
  [ApplicationStatus.Errored]: {
    icon: CircleAlert,
    pillClassName: 'border-destructive/40 text-destructive',
    description: 'Error',
  },
  [ApplicationStatus.Pausing]: {
    icon: PauseCircle,
    iconClassName: 'animate-blinking',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Pausing',
  },
  [ApplicationStatus.Restoring]: {
    icon: RotateCw,
    iconClassName: 'animate-spin',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Restoring',
  },
  [ApplicationStatus.Paused]: {
    icon: PauseCircle,
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Paused',
  },
  [ApplicationStatus.Unpausing]: {
    icon: PlayCircle,
    iconClassName: 'animate-blinking',
    pillClassName: 'border-slate-400/40 text-slate-500 dark:text-slate-400',
    description: 'Waking up',
  },
  [ApplicationStatus.Live]: {
    icon: CircleCheck,
    pillClassName: 'border-primary-main/40 text-primary-main',
    description: 'Live',
  },
};

export default function ProjectStatusPill({
  status,
}: {
  status: ApplicationStatus;
}) {
  const style = PROJECT_STATUS_PILL_STYLES[status];

  if (!style) {
    return null;
  }

  const { icon: Icon, iconClassName, pillClassName, description } = style;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-[0.3rem] pr-2.5 ${pillClassName}`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${iconClassName ?? ''}`} />
      <span className="whitespace-nowrap font-medium text-xs">
        {description}
      </span>
    </div>
  );
}
