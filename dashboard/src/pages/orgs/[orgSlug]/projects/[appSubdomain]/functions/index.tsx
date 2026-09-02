import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { FunctionsBrowserSidebar } from '@/features/orgs/projects/serverless-functions/components/FunctionsBrowserSidebar';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import { getFunctionsLayout } from '@/features/orgs/projects/serverless-functions/layout';

export default function FunctionsPage() {
  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <FunctionsEmptyState
        title="Functions"
        description="An error occurred while fetching functions."
      />
    );
  }

  if (Array.isArray(functions) && functions.length === 0) {
    return (
      <FunctionsEmptyState
        title="Functions"
        description="No functions have been deployed yet."
      />
    );
  }

  return (
    <FunctionsEmptyState
      title="Functions"
      description="Select a function from the sidebar to get started."
    />
  );
}

FunctionsPage.getLayout = function getLayout(page: ReactElement) {
  return getFunctionsLayout(page, {
    sidebar: <FunctionsBrowserSidebar />,
    contentClassName:
      'box flex w-full flex-auto flex-col overflow-x-hidden bg-default',
  });
};
