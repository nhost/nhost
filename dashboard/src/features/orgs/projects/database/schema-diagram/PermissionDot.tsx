import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { cn } from '@/lib/utils';
import type { PermissionDotState } from './permissionState';

const actionClasses: Record<DatabaseAction, { bg: string; border: string }> = {
  select: { bg: 'bg-blue-500', border: 'border-blue-500' },
  insert: { bg: 'bg-green-500', border: 'border-green-500' },
  update: { bg: 'bg-amber-500', border: 'border-amber-500' },
  delete: { bg: 'bg-red-500', border: 'border-red-500' },
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
  /**
   * Overrides the accessible label and tooltip. Use when the dot's state has a
   * context-specific meaning (e.g. a function's `hollow` dot does not mean "row
   * filter"). Falls back to the action/state-derived label when omitted.
   */
  label?: string;
}

export default function PermissionDot({
  action,
  state,
  size = 10,
  className,
  label,
}: PermissionDotProps) {
  const { bg, border } = actionClasses[action];
  const title = label ?? `${actionLabels[action]}: ${stateLabels[state]}`;

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      style={{ width: size, height: size }}
      className={cn(
        'inline-block rounded-full border-2',
        state === 'filled' && [bg, border],
        state === 'hollow' && ['bg-transparent', border],
        state === 'none' && 'border-slate-400 bg-transparent opacity-[0.35]',
        className,
      )}
    />
  );
}
