import { Database, InfoIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import { IconButton } from '@/components/ui/v2/IconButton';
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

export interface EventTriggersBrowserSidebarProps {
  className?: string;
}

function EventTriggersBrowserSidebarContent() {
  const {
    data: eventTriggersData,
    isLoading: isLoadingEventTriggers,
    error: errorEventTriggers,
  } = useGetEventTriggers();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

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
      {isGitHubConnected && (
        <div className="box mt-1.5 flex items-center gap-2 px-2">
          <InfoIcon className="size-6" />
          <p className="text-disabled text-xs">
            GitHub connected - use the CLI for event trigger changes
          </p>
        </div>
      )}
      <Accordion
        type="multiple"
        defaultValue={['event-triggers']}
        className="w-full"
      >
        <AccordionItem value="event-triggers" id="event-triggers">
          <CreateEventTriggerForm disabled={isGitHubConnected} />
          <div className="pb-0">
            <div className="flex flex-row gap-2">
              <Accordion
                type="single"
                collapsible
                className="w-full"
                defaultValue="default"
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
                            isViewOnly={isGitHubConnected}
                          />
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ),
                )}
              </Accordion>
            </div>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default function EventTriggersBrowserSidebar({
  className,
}: EventTriggersBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  useEffect(() => {
    function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute top-0 right-0 bottom-0 left-0 z-[34] sm:hidden"
        role="button"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        aria-label="Close sidebar overlay"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setExpanded(false);
        }}
      />

      <aside
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pt-2 pb-17 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pt-2.5 sm:pb-0 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
      >
        <RetryableErrorBoundary>
          <EventTriggersBrowserSidebarContent />
        </RetryableErrorBoundary>
      </aside>

      <IconButton
        className="absolute bottom-4 left-4 z-[38] h-11 w-11 rounded-full md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </IconButton>
    </>
  );
}
