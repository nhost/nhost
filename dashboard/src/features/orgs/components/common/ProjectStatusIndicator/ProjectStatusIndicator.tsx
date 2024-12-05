import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

export default function ProjectStatusIndicator({
  status,
}: {
  status: ApplicationStatus;
}) {
  const indicatorStyles: Record<
    number,
    { className: string; description: string }
  > = {
    [ApplicationStatus.Errored]: {
      className: 'bg-destructive',
      description: 'Project errored',
    },
    [ApplicationStatus.Pausing]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is pausing',
    },
    [ApplicationStatus.Restoring]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is restoring',
    },
    [ApplicationStatus.Paused]: {
      className: 'bg-slate-400',
      description: 'Project is paused',
    },
    [ApplicationStatus.Unpausing]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is unpausing',
    },
    [ApplicationStatus.Live]: {
      className: 'bg-primary-main',
      description: 'Project is live',
    },
  };
  const style = indicatorStyles[status];

  if (style) {
    return (
      <HoverCard openDelay={0}>
        <HoverCardTrigger asChild>
          <span
            className={cn(
              'mt-[2px] h-2 w-2 flex-shrink-0 rounded-full',
              style.className,
            )}
          />
        </HoverCardTrigger>
        <HoverCardContent side="top" className="h-fit w-fit py-2">
          {style.description}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return null;
}
