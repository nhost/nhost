import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getEventsLayout } from '@/features/orgs/projects/events/layout';
import { OneOffsView } from '@/features/orgs/projects/events/one-offs/components/OneOffsView';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function OneOffsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <OneOffsView />
    </RetryableErrorBoundary>
  );
}

OneOffsPage.getLayout = function getLayout(page: ReactElement) {
  return getEventsLayout(page, {
    contentClassName:
      'box flex w-full flex-auto flex-col overflow-x-hidden overflow-y-hidden',
  });
};
