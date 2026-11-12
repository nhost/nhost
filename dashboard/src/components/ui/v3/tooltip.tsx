import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

// Whether the open tooltip is interactive, so TooltipContent can let clicks
// through or not without callers repeating it.
const TooltipInteractiveContext = React.createContext(false);

// A tooltip is a label: it closes as soon as the pointer leaves the trigger,
// and its content lets clicks through, so it never blocks the button under it.
// A tooltip with a link inside is `interactive`: it stays open while hovered
// and its content can be clicked.
function Tooltip({
  interactive = false,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipPrimitive.Root>,
  'disableHoverableContent'
> & {
  interactive?: boolean;
}) {
  return (
    <TooltipInteractiveContext.Provider value={interactive}>
      <TooltipProvider>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          disableHoverableContent={!interactive}
          {...props}
        />
      </TooltipProvider>
    </TooltipInteractiveContext.Provider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const interactive = React.useContext(TooltipInteractiveContext);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 animate-in overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm shadow-overlay data-[state=closed]:animate-out',
          interactive ? 'pointer-events-auto' : 'pointer-events-none',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
