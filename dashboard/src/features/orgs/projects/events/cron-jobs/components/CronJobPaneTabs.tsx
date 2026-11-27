import type { ComponentProps } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/v3/tabs';

export function CronJobPaneTabs(props: ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      {...props}
      className="h-auto gap-6 rounded-none bg-transparent p-0 text-foreground"
    />
  );
}

export function CronJobPaneTab(props: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      {...props}
      className="h-10 rounded-none border-transparent border-b-2 px-0 font-semibold hover:text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
    />
  );
}
