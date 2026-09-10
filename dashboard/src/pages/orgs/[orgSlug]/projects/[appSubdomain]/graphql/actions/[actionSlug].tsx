import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ActionDetails } from '@/features/orgs/projects/graphql/actions/components/ActionDetails';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/graphql/actions/components/ActionsBrowserSidebar';
import { getGraphQLLayout } from '@/features/orgs/projects/graphql/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function ActionDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <ActionDetails />
    </RetryableErrorBoundary>
  );
}

ActionDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return getGraphQLLayout(page, {
    sidebar: <ActionsBrowserSidebar />,
    contentClassName:
      'flex w-full flex-auto flex-col overflow-x-hidden bg-background',
  });
};
