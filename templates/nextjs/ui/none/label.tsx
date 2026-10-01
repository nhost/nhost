import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A plain `<label>`. Clicking it focuses the control it names, which the
 * browser does for any label carrying `htmlFor`, so the Radix primitive the
 * shadcn/ui version wraps is not needed to get that behaviour.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // This is the shared Label rather than a label for one field, and whoever
    // renders it passes `htmlFor` - which the rule cannot see through the
    // spread. The shadcn/ui version has the same contract and escapes the rule
    // only by being a Radix element instead of a <label>.
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller supplies htmlFor
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
