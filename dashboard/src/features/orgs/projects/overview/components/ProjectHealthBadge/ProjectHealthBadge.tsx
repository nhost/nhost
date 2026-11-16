import type { HTMLAttributes, ReactNode } from 'react';
import { ProjectHealthCheckIcon } from '@/components/ui/v3/icons/ProjectHealthCheckIcon';
import { ProjectHealthExclamationIcon } from '@/components/ui/v3/icons/ProjectHealthExclamationIcon';
import { QuestionMarkIcon } from '@/components/ui/v3/icons/QuestionMarkIcon';
import type { ServiceStateTone } from '@/features/orgs/projects/overview/health';
import { cn } from '@/lib/utils';

const badgeColorClassName: Record<ServiceStateTone, string> = {
  success: 'bg-emerald-600',
  error: 'bg-destructive',
  warning: 'bg-amber-500',
  secondary: 'bg-grey-500',
};

export interface ProjectHealthBadgeProps
  extends HTMLAttributes<HTMLSpanElement> {
  badgeVariant?: 'standard' | 'dot';
  badgeColor?: ServiceStateTone;
  unknownState?: boolean;
  showExclamation?: boolean;
  showCheckIcon?: boolean;
  isLoading?: boolean;
  blink?: boolean;
  children?: ReactNode;
}

export default function ProjectHealthBadge({
  badgeColor,
  badgeVariant,
  showExclamation,
  showCheckIcon,
  unknownState,
  blink,
  children,
  className,
  ...props
}: ProjectHealthBadgeProps) {
  let innerBadgeContent: ReactNode | null = null;
  if (unknownState) {
    innerBadgeContent = (
      <QuestionMarkIcon className="h-2 w-2 stroke-2 text-background" />
    );
  } else if (showCheckIcon) {
    innerBadgeContent = (
      <ProjectHealthCheckIcon className="h-2 w-2 text-background" />
    );
  }

  return (
    <span className={cn('relative inline-flex', className)} {...props}>
      {children}
      {badgeColor && (
        <span
          className={cn(
            'absolute top-0 right-0 flex h-2.5 w-2.5 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full ring-2 ring-card',
            badgeColorClassName[badgeColor],
            badgeVariant === 'dot' && 'h-2.5 w-2.5',
            blink && 'animate-pulse',
          )}
        >
          {badgeVariant !== 'dot' ? innerBadgeContent : null}
        </span>
      )}
      {showExclamation && (
        <span className="absolute right-0 bottom-0 flex h-3 w-3 translate-x-1/3 translate-y-1/3 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <ProjectHealthExclamationIcon className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      )}
    </span>
  );
}
