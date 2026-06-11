import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { CreateActionForm } from '@/features/orgs/projects/actions/components/CreateActionForm';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import ActionListItem from './ActionListItem';
import ActionsBrowserSidebarSkeleton from './ActionsBrowserSidebarSkeleton';

function ActionsBrowserSidebarContent() {
  const {
    data: actionsData,
    isLoading: isLoadingActions,
    error: errorActions,
  } = useGetActions();

  if (isLoadingActions) {
    return <ActionsBrowserSidebarSkeleton />;
  }

  if (errorActions instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
            Actions could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex flex-col gap-0">
        <div className="flex flex-row items-center justify-between">
          <CreateActionForm />
        </div>
        <div className="flex flex-col text-balance">
          {(actionsData?.actions ?? []).map((action) => (
            <ActionListItem key={action.name} action={action} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ActionsBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar>
      <ActionsBrowserSidebarContent />
    </FeatureSidebar>
  );
}
