import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import { IconButton } from '@/components/ui/v2/IconButton';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/CreateCronTriggerForm';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import CronTriggerListItem from './CronTriggerListItem';
import CronTriggersBrowserSidebarSkeleton from './CronTriggersBrowserSidebarSkeleton';

export interface CronTriggersBrowserSidebarProps {
  className?: string;
}

function CronTriggersBrowserSidebarContent() {
  const {
    data: cronTriggersData,
    isLoading: isLoadingCronTriggers,
    error: errorCronTriggers,
  } = useGetCronTriggers();

  if (isLoadingCronTriggers) {
    return <CronTriggersBrowserSidebarSkeleton />;
  }

  if (errorCronTriggers instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
            Cron triggers could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex flex-col gap-0">
        <div className="flex flex-row items-center justify-between">
          <CreateCronTriggerForm />
        </div>
        <div className="flex flex-col text-balance">
          {(cronTriggersData ?? []).map((cronTrigger) => (
            <CronTriggerListItem
              key={cronTrigger.name}
              cronTrigger={cronTrigger}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CronTriggersBrowserSidebar({
  className,
}: CronTriggersBrowserSidebarProps) {
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

      <aside
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pb-17 pt-2 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pb-0 sm:pt-2.5 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
      >
        <RetryableErrorBoundary>
          <CronTriggersBrowserSidebarContent />
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
