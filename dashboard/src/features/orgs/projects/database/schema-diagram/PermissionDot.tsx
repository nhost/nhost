import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { cn } from '@/lib/utils';
import type { PermissionDotState } from './permissionState';

const actionColors: Record<DatabaseAction, string> = {
  select: 'rgb(59, 130, 246)',
  insert: 'rgb(34, 197, 94)',
  update: 'rgb(245, 158, 11)',
  delete: 'rgb(239, 68, 68)',
};

const actionLabels: Record<DatabaseAction, string> = {
  select: 'Select',
  insert: 'Insert',
  update: 'Update',
  delete: 'Delete',
};

const stateLabels: Record<PermissionDotState, string> = {
  filled: 'allowed (no row filter)',
  hollow: 'allowed with row filter / check',
  none: 'not allowed',
};

export interface PermissionDotProps {
  action: DatabaseAction;
  state: PermissionDotState;
  size?: number;
  className?: string;
}

export default function PermissionDot({
  action,
  state,
  size = 10,
  className,
}: PermissionDotProps) {
  const color = actionColors[action];
  const title = `${actionLabels[action]}: ${stateLabels[state]}`;

  const style: React.CSSProperties =
    state === 'none'
      ? {
          width: size,
          height: size,
          backgroundColor: 'transparent',
          borderColor: 'rgb(148, 163, 184)',
          opacity: 0.35,
        }
      : state === 'hollow'
        ? {
            width: size,
            height: size,
            backgroundColor: 'transparent',
            borderColor: color,
          }
        : {
            width: size,
            height: size,
            backgroundColor: color,
            borderColor: color,
          };

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('inline-block rounded-full border-2', className)}
      style={style}
    />
  );
}
