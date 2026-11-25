import * as TabsPrimitive from '@radix-ui/react-tabs';
import type * as React from 'react';

import { UNDERLINE_TAB_CLASS } from '@/components/ui/v3/tab-styles';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = ({
  className,
  ref,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: 'underline';
}) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      variant === 'underline'
        ? 'inline-flex h-10 items-center gap-6 text-muted-foreground dark:text-sidebar-foreground'
        : 'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
);

const TabsTrigger = ({
  className,
  ref,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  variant?: 'underline';
}) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      variant === 'underline'
        ? UNDERLINE_TAB_CLASS
        : 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-raised',
      className,
    )}
    {...props}
  />
);

const TabsContent = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
