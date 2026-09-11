import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import NativeQuerySourceGuard from '@/features/orgs/projects/database/native-queries/components/NativeQuerySourceGuard/NativeQuerySourceGuard';
import { NoLogicalModelsEmptyState } from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function NativeQueriesIndexContent({ source }: { source: string }) {
  const { data: models = [], isLoading, error } = useGetLogicalModels(source);

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
    return <NoLogicalModelsEmptyState source={source} />;
  }

  return (
    <NativeQueriesEmptyState
      title="Native queries"
      description="Select a logical model or native query from the sidebar, or create a new one."
    />
  );
}

export default function NativeQueriesIndexPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { dataSourceSlug } = useRouter().query;
  const source = typeof dataSourceSlug === 'string' ? dataSourceSlug : '';

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <NativeQuerySourceGuard source={source}>
      <NativeQueriesIndexContent source={source} />
    </NativeQuerySourceGuard>
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
