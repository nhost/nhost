import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ServiceVersionGate } from '@/features/orgs/guards/ServiceVersionGate';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';
import { LogicalModelDetails } from '@/features/orgs/projects/database/native-queries/components/LogicalModelDetails';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesUpgradeRequired } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesUpgradeRequired';
import { MIN_HASURA_VERSION_NATIVE_QUERIES } from '@/features/orgs/projects/database/native-queries/constants';

export default function LogicalModelDetailsPage() {
  return (
    <RetryableErrorBoundary>
      <LogicalModelDetails />
    </RetryableErrorBoundary>
  );
}

LogicalModelDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <ServiceVersionGate
            service="hasura"
            minVersion={MIN_HASURA_VERSION_NATIVE_QUERIES}
            fallback={<NativeQueriesUpgradeRequired />}
            loadingFallback={<LoadingScreen />}
          >
            <div className="flex h-full">
              <NativeQueriesBrowserSidebar />
              <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
                {page}
              </div>
            </div>
          </ServiceVersionGate>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
