import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { BaseEventTriggerFormTriggerProps } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import { CreateEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/CreateEventTriggerForm';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { Database, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import EventsBrowserSidebarSkeleton from './EventsBrowserSidebarSkeleton';
import EventTriggerListItem from './EventTriggerListItem';

export interface EventsBrowserSidebarProps extends Omit<BoxProps, 'children'> {}

function EventsBrowserSidebarContent() {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const { data, isLoading, error } = useGetEventTriggers();
  const handleDeleteEventTriggerDropdownClick = () => {};

  const renderCreateEventTriggerButton = useCallback(
    ({ open }: BaseEventTriggerFormTriggerProps) => (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Add event trigger"
        onClick={() => open()}
      >
        <Plus className="h-5 w-5 text-primary dark:text-foreground" />
      </Button>
    ),
    [],
  );

  if (isLoading) {
    return <EventsBrowserSidebarSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
            Events could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const eventTriggersByDataSource = data?.reduce<
    Record<string, EventTriggerViewModel[]>
  >((acc, eventTrigger) => {
    const key = eventTrigger.dataSource;
    if (!acc[key]) {
      acc[key] = [];
    }
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
      <div className="flex flex-row items-center justify-between">
        <p className="font-semibold leading-7 [&:not(:first-child)]:mt-6">
          Event Triggers ({data?.length ?? 0})
        </p>

        <CreateEventTriggerForm
          trigger={renderCreateEventTriggerButton}
          onSubmit={(newEventTrigger) => {
            router.push(
              `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-trigger/${newEventTrigger.triggerName}`,
            );
          }}
        />
      </div>
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
                <AccordionTrigger className="flex-row-reverse justify-end gap-2 [&[data-state=closed]>svg:last-child]:-rotate-90 [&[data-state=open]>svg:last-child]:rotate-0">
                  {dataSource}
                  <Database className="h-4 w-4 !rotate-0" />
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-1 text-balance pl-4">
                  {eventTriggers.map((eventTrigger) => {
                    const isSelected = eventTrigger.name === eventTriggerSlug;
                    const href = `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-trigger/${eventTrigger.name}`;
                    return (
                      <EventTriggerListItem
                        key={eventTrigger.name}
                        eventTrigger={eventTrigger}
                        href={href}
                        isSelected={isSelected}
                        onEditSubmit={(updatedEventTrigger) => {
                          router.push(
                            `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-trigger/${updatedEventTrigger.triggerName}`,
                          );
                        }}
                        onDelete={() => handleDeleteEventTriggerDropdownClick()}
                      />
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ),
          )}
        </Accordion>
      </div>
    </div>
  );
}

export default function EventsBrowserSidebar({
  className,
  ...props
}: EventsBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setExpanded(false);
    }
  }

  useEffect(() => {
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
        className="absolute bottom-0 left-0 right-0 top-0 z-[34] sm:hidden"
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

      <Box
        component="aside"
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pb-17 pt-2 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pb-0 sm:pt-2.5 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
        {...props}
      >
        <RetryableErrorBoundary>
          <EventsBrowserSidebarContent />
        </RetryableErrorBoundary>
      </Box>

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
