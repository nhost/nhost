import { useMemo } from 'react';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import FunctionListItem from './FunctionListItem';

function FunctionsBrowserSidebarContent() {
  const { data: functions, loading, error } = useGetNhostFunctions();

  const sortedFunctions = useMemo(
    () => [...functions].sort((a, b) => a.path.localeCompare(b.path)),
    [functions],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-2">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col px-2">
        <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
          Functions could not be loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-2">
      <div className="w-full">
        <div className="flex flex-col gap-1 py-2">
          {sortedFunctions.map((fn) => (
            <FunctionListItem key={fn.path} nhostFunction={fn} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FunctionsBrowserSidebar() {
  return (
    <FeatureSidebar className="bg-background">
      <FunctionsBrowserSidebarContent />
    </FeatureSidebar>
  );
}
