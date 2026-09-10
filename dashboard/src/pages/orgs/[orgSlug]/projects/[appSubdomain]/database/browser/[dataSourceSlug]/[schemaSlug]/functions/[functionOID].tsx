import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { FunctionDefinitionView } from '@/features/orgs/projects/database/dataGrid/components/FunctionDefinitionView';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DataBrowserFunctionDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <FunctionDefinitionView />
    </RetryableErrorBoundary>
  );
}

DataBrowserFunctionDetailsPage.getLayout = function getLayout(
  page: ReactElement,
) {
  return getDatabaseLayout(page, {
    sidebar: <DataBrowserSidebar />,
    contentClassName: 'box flex w-full flex-auto flex-col overflow-x-hidden',
  });
};
