import { Badge, type BadgeProps } from '@/components/ui/v2/Badge';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ExclamationFilledIcon } from '@/components/ui/v2/icons/ExclamationFilledIcon';
import { QuestionMarkIcon } from '@/components/ui/v2/icons/QuestionMarkIcon';

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
  let innerBadgeContent = null;
  if (unknownState) {
    innerBadgeContent = (
      <QuestionMarkIcon
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
        }}
        className="h-2 w-2 stroke-2"
      />
    );
  } else if (showCheckIcon) {
    innerBadgeContent = (
      <CheckIcon
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
        }}
        className="h-2 w-2 stroke-2"
      />
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
          <ExclamationFilledIcon
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.900' : 'grey.600',
            }}
            className="h-2.5 w-2.5"
          />
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
