import type { HTMLAttributes } from 'react';
import {
  serviceStateToIndicatorClassName,
  serviceStateToLabel,
} from '@/features/orgs/projects/overview/health';
import type { ServiceState } from '@/generated/graphql';
import { cn } from '@/lib/utils';

export interface ServiceStateIndicatorProps
  extends HTMLAttributes<HTMLSpanElement> {
  state?: ServiceState;
  /**
   * Overrides the default label of the state.
   */
  label?: string;
}

export default function ServiceStateIndicator({
  state,
  label,
  className,
  ...props
}: ServiceStateIndicatorProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm', className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          serviceStateToIndicatorClassName.get(state),
        )}
      />
      {label ?? serviceStateToLabel.get(state)}
    </span>
  );
}
