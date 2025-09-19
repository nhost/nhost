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
import { useGetEventTriggers } from '@/features/orgs/projects/events/hooks/useGetEventTriggers';
import type { EventTriggerUI } from '@/features/orgs/projects/events/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { Database, Ellipsis, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface EventsBrowserSidebarProps extends Omit<BoxProps, 'children'> {}

function EventsBrowserSidebarContent() {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const { data } = useGetEventTriggers();

  const eventTriggersByDataSource = data?.reduce<
    Record<string, EventTriggerUI[]>
  >((acc, eventTrigger) => {
    const key = eventTrigger.dataSource;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key] = [...acc[key], eventTrigger];
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex flex-row items-center justify-between">
        <p className="font-semibold leading-7 [&:not(:first-child)]:mt-6">
          Event Triggers ({data?.length ?? 0})
        </p>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Add event trigger"
          data-testid="addEventTriggerButton"
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
              <AccordionItem value={dataSource}>
                <AccordionTrigger className="flex-row-reverse justify-end gap-2 [&[data-state=closed]>svg:last-child]:-rotate-90 [&[data-state=open]>svg:last-child]:rotate-0">
                  {dataSource}
                  <Database className="h-4 w-4 !rotate-0" />
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-4 text-balance">
                  {eventTriggers.map((eventTrigger) => {
                    const isSelected = eventTrigger.name === eventTriggerSlug;
                    return (
                      <Button
                        className={cn(
                          'ml-4 h-fit justify-between py-0 pr-0 text-left hover:bg-primary-light hover:text-primary',
                          isSelected && 'bg-primary-light text-primary',
                        )}
                        key={eventTrigger.name}
                        asChild
                        variant="ghost"
                      >
                        <Link
                          href={`/orgs/${orgSlug}/projects/${appSubdomain}/settings/events/event-trigger/${eventTrigger.name}`}
                        >
                          {eventTrigger.name}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => {
                              e.preventDefault();
                            }}
                          >
                            <Ellipsis className="h-5 w-5" />
                          </Button>
                        </Link>
                      </Button>
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
