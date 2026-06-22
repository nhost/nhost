import type { ReactNode } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/v2/Badge';
import { ProjectHealthCheckIcon } from '@/components/ui/v3/icons/ProjectHealthCheckIcon';
import { ProjectHealthExclamationIcon } from '@/components/ui/v3/icons/ProjectHealthExclamationIcon';
import { QuestionMarkIcon } from '@/components/ui/v3/icons/QuestionMarkIcon';

export interface ProjectHealthBadgeProps extends BadgeProps {
  badgeVariant?: 'standard' | 'dot';
  badgeColor?: 'success' | 'error' | 'warning' | 'secondary';
  unknownState?: boolean;
  showExclamation?: boolean;
  showCheckIcon?: boolean;
  isLoading?: boolean;
  blink?: boolean;
}

export default function ProjectHealthBadge({
  badgeColor,
  badgeVariant,
  showExclamation,
  showCheckIcon,
  unknownState,
  blink,
  children,
  ...props
}: ProjectHealthBadgeProps) {
  let innerBadgeContent: ReactNode | null = null;
  if (unknownState) {
    innerBadgeContent = (
      <QuestionMarkIcon className="h-2 w-2 stroke-2 text-[#F5F5F5] dark:text-[#21262D]" />
    );
  } else if (showCheckIcon) {
    innerBadgeContent = (
      <ProjectHealthCheckIcon className="h-2 w-2 text-[#F5F5F5] dark:text-[#21262D]" />
    );
  }

  if (!badgeColor) {
    return <div>{children}</div>;
  }

  if (showExclamation) {
    return (
      <Badge
        variant="standard"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        badgeContent={
          <ProjectHealthExclamationIcon className="h-2.5 w-2.5 text-muted-foreground dark:text-foreground" />
        }
      >
        <Badge
          color={badgeColor}
          variant={badgeVariant}
          badgeContent={innerBadgeContent}
          sx={{
            color: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.900' : 'text.primary',
          }}
          componentsProps={{
            badge: {
              className: blink ? 'animate-pulse' : '',
            },
          }}
          {...props}
        >
          {children}
        </Badge>
      </Badge>
    );
  }
  return (
    <Badge
      color={badgeColor}
      variant={badgeVariant}
      badgeContent={innerBadgeContent}
      componentsProps={{
        badge: {
          className: blink ? 'animate-pulse' : '',
        },
      }}
      {...props}
    >
      {children}
    </Badge>
  );
}
