import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { LogicalModelDetails } from '@/features/orgs/projects/database/native-queries/components/LogicalModelDetails';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesUpgradeRequired } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesUpgradeRequired';
import { useIsNativeQueriesSupported } from '@/features/orgs/projects/database/native-queries/hooks/useIsNativeQueriesSupported';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function LogicalModelDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { loading: loadingSupport, isSupported } =
    useIsNativeQueriesSupported();

  if (loadingSupport || (isPlatform && !project?.config?.hasura.adminSecret)) {
    return <LoadingScreen />;
  }

  if (!isSupported) {
    return <NativeQueriesUpgradeRequired />;
  }

  return (
    <RetryableErrorBoundary>
      <LogicalModelDetails />
    </RetryableErrorBoundary>
  );
}

LogicalModelDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <NativeQueriesBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
        {page}
      </div>
    </OrgLayout>
  );
};
