import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { BaseEventTriggerFormInitialData } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { CreateEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/CreateEventTriggerForm';
import { EditEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/EditEventTriggerForm';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import parseEventTriggerFormInitialData from '@/features/orgs/projects/events/event-triggers/utils/parseEventTriggerFormInitialData/parseEventTriggerFormInitialData';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { Database, Ellipsis, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import EventsBrowserSidebarSkeleton from './EventsBrowserSidebarSkeleton';

export interface EventsBrowserSidebarProps extends Omit<BoxProps, 'children'> {}

function EventsBrowserSidebarContent() {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const { data, isLoading, error } = useGetEventTriggers();
  const [createEventTriggerFormOpen, setCreateEventTriggerFormOpen] =
    useState(false);
  const [editEventTriggerFormOpen, setEditEventTriggerFormOpen] =
    useState(false);
  const [editEventTriggerInitialData, setEditEventTriggerInitialData] =
    useState<BaseEventTriggerFormInitialData | undefined>(undefined);

  const handleEditEventTriggerDropdownClick = (eventTriggerName: string) => {
    const selectedEventTrigger = data?.find(
      (eventTrigger) => eventTrigger.name === eventTriggerName,
    );
    const initialData = selectedEventTrigger
      ? parseEventTriggerFormInitialData(selectedEventTrigger)
      : undefined;
    setEditEventTriggerInitialData(initialData);
    console.log(initialData);
    setEditEventTriggerFormOpen(true);
  };

  const handleDeleteEventTriggerDropdownClick = (
    eventTriggerName: string,
  ) => {};

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

  const handleAddEventTrigger = () => {
    setCreateEventTriggerFormOpen(true);
  };

  return (
    <>
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-semibold leading-7 [&:not(:first-child)]:mt-6">
            Event Triggers ({data?.length ?? 0})
          </p>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Add event trigger"
            onClick={handleAddEventTrigger}
          >
            <Plus className="h-5 w-5 text-primary dark:text-foreground" />
          </Button>
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
                      return (
                        <div className="group relative flex">
                          <Button
                            className={cn(
                              'flex h-9 max-w-52 flex-row justify-between gap-2 bg-background px-2 text-foreground hover:bg-accent dark:hover:bg-theme-grey-200',
                              {
                                'bg-[#ebf3ff] hover:bg-[#ebf3ff] dark:bg-muted dark:hover:bg-muted':
                                  isSelected,
                              },
                            )}
                            key={eventTrigger.name}
                            asChild
                            variant="ghost"
                          >
                            <Link
                              href={`/orgs/${orgSlug}/projects/${appSubdomain}/events/event-trigger/${eventTrigger.name}`}
                              className="flex w-full items-center gap-2"
                            >
                              <TextWithTooltip
                                containerClassName="max-w-36"
                                className={cn(
                                  isSelected &&
                                    'text-primary hover:text-primary',
                                )}
                                text={eventTrigger.name}
                              />
                            </Link>
                          </Button>
                          <DropdownMenu modal={false}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'invisible absolute right-2 top-1 h-7 w-7 px-0.5 hover:bg-[#eaedf0] group-hover:visible dark:hover:bg-[#2f363d]',
                                {
                                  'visible bg-[#ebf3ff] text-primary hover:bg-[#ebf3ff] hover:text-primary dark:bg-muted dark:hover:bg-muted':
                                    isSelected,
                                },
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                              }}
                              asChild
                            >
                              <DropdownMenuTrigger>
                                <Ellipsis className="h-6 w-6" />
                              </DropdownMenuTrigger>
                            </Button>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onSelect={() =>
                                  handleEditEventTriggerDropdownClick(
                                    eventTrigger.name,
                                  )
                                }
                                className="flex cursor-pointer items-center gap-2 !text-sm+ font-medium"
                              >
                                <PencilIcon className="size-4 text-muted-foreground" />
                                Edit Event Trigger
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-0" />
                              <DropdownMenuItem
                                onSelect={() =>
                                  handleDeleteEventTriggerDropdownClick(
                                    eventTrigger.name,
                                  )
                                }
                                className="flex cursor-pointer items-center gap-2 !text-sm+ font-medium text-destructive focus:text-destructive"
                              >
                                <TrashIcon className="size-4" />
                                Delete Event Trigger
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              ),
            )}
          </Accordion>
        </div>
      </div>
      <CreateEventTriggerForm
        open={createEventTriggerFormOpen}
        onOpenChange={setCreateEventTriggerFormOpen}
        onSubmit={() => {}}
      />
      <EditEventTriggerForm
        initialData={editEventTriggerInitialData}
        open={editEventTriggerFormOpen}
        onOpenChange={setEditEventTriggerFormOpen}
        onSubmit={() => {}}
      />
    </>
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
