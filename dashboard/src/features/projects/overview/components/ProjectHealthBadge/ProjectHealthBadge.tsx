import { Badge, type BadgeProps } from '@/components/ui/v2/Badge';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ExclamationFilledIcon } from '@/components/ui/v2/icons/ExclamationFilledIcon';

export interface ProjectHealthBadgeProps extends BadgeProps {
  badgeVariant?: 'standard' | 'dot';
  badgeColor?: 'success' | 'error' | 'warning' | 'secondary';
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
  blink,
  children,
  ...props
}: ProjectHealthBadgeProps) {
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
          badgeContent={
            showCheckIcon ? (
              <CheckIcon
                sx={{
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                }}
                className="h-2 w-2 stroke-2"
              />
            ) : null
          }
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
      badgeContent={
        showCheckIcon ? (
          <CheckIcon
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
            }}
            className="h-2 w-2 stroke-2"
          />
        ) : null
      }
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
