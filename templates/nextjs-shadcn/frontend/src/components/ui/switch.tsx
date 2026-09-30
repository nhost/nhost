'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import type * as React from 'react';
import { cn } from '@/lib/utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {/* Travel is stated in pixels rather than as a percentage: the track is
          36px wide with a 1px border each side and the thumb is 16px, so the
          two resting positions are 2px and 18px. A percentage translate would
          be measured against the thumb instead and stop short of the end. */}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
          'data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
