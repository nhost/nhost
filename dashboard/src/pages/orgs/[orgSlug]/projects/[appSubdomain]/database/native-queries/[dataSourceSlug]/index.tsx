import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { InlineCode } from '@/components/presentational/InlineCode';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { NoLogicalModelsEmptyState } from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function NativeQueriesIndexPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { query } = useRouter();
  const { data: models = [], isLoading, error } = useGetLogicalModels();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  if (query.dataSourceSlug !== 'default') {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={
          <span>
            Database <InlineCode>{query.dataSourceSlug}</InlineCode> does not
            exist.
          </span>
        }
      />
    );
  }

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

NativeQueriesIndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <NativeQueriesBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
        {page}
      </div>
    </OrgLayout>
  );
};
