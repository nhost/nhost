import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ServiceVersionGate } from '@/features/orgs/guards/ServiceVersionGate';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { NativeQueriesUpgradeRequired } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesUpgradeRequired';
import { NoLogicalModelsEmptyState } from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import { MIN_HASURA_VERSION_NATIVE_QUERIES } from '@/features/orgs/projects/database/native-queries/constants';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';

function NativeQueriesIndexContent() {
  const { data: models = [], isLoading, error } = useGetLogicalModels();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error instanceof Error) {
    return (
      <NativeQueriesEmptyState
        title="Something went wrong"
        description="Logical models could not be loaded. Please try again."
      />
    );
  }

  if (models.length === 0) {
    return <NoLogicalModelsEmptyState />;
  }

  return (
    <NativeQueriesEmptyState
      title="Native queries"
      description="Select a logical model or native query from the sidebar, or create a new one."
    />
  );
}

export default function NativeQueriesIndexPage() {
  const { dataSourceSlug } = useRouter().query;

  if (dataSourceSlug !== 'default') {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={
          <span>
            Database <InlineCode>{dataSourceSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  return <NativeQueriesIndexContent />;
}

NativeQueriesIndexPage.getLayout = function getLayout(page: ReactElement) {
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
