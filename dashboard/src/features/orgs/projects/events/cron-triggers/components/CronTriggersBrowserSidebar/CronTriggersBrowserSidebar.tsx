import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/CreateCronTriggerForm';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import CronTriggerListItem from './CronTriggerListItem';
import CronTriggersBrowserSidebarSkeleton from './CronTriggersBrowserSidebarSkeleton';

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

export default function CronTriggersBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar>
      <CronTriggersBrowserSidebarContent />
    </FeatureSidebar>
  );
}
