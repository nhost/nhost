import { Database } from 'lucide-react';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/CreateEventTriggerForm';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import EventTriggerListItem from './EventTriggerListItem';
import EventTriggersBrowserSidebarSkeleton from './EventTriggersBrowserSidebarSkeleton';

function EventTriggersBrowserSidebarContent() {
  const {
    data: eventTriggersData,
    isLoading: isLoadingEventTriggers,
    error: errorEventTriggers,
  } = useGetEventTriggers();
  if (isLoadingEventTriggers) {
    return <EventTriggersBrowserSidebarSkeleton />;
  }

  if (errorEventTriggers instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
            Event triggers could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const eventTriggersByDataSource = eventTriggersData?.reduce<
    Record<string, EventTriggerViewModel[]>
  >((acc, eventTrigger) => {
    const key = eventTrigger.dataSource;
    if (!acc[key]) {
      // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
      acc[key] = [];
    }
    // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
    acc[key] = [...acc[key], eventTrigger];
    return acc;
  }, {});

  if (eventTriggersByDataSource) {
    Object.keys(eventTriggersByDataSource).forEach((dataSource) => {
      eventTriggersByDataSource[dataSource].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    });
  }

  return (
    <div className="flex h-full flex-col px-2">
      <div className="w-full">
        <CreateEventTriggerForm />
        <div className="pb-0">
          <div className="flex flex-row gap-2">
            <Accordion
              type="multiple"
              className="w-full"
              defaultValue={['default']}
            >
              {Object.entries(eventTriggersByDataSource ?? {}).map(
                ([dataSource, eventTriggers]) => (
                  <AccordionItem
                    key={dataSource}
                    value={dataSource}
                    id={dataSource}
                  >
                    <AccordionTrigger className="flex-row-reverse justify-end gap-2 text-sm+ [&[data-state=closed]>svg:last-child]:-rotate-90 [&[data-state=open]>svg:last-child]:rotate-0">
                      <div className="flex flex-row-reverse items-center gap-2">
                        {`${dataSource} (${eventTriggers.length})`}
                        <Database className="!rotate-0 size-4" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-1 text-balance pl-4">
                      {eventTriggers.map((eventTrigger) => (
                        <EventTriggerListItem
                          key={eventTrigger.name}
                          eventTrigger={eventTrigger}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ),
              )}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventTriggersBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar>
      <EventTriggersBrowserSidebarContent />
    </FeatureSidebar>
  );
}
