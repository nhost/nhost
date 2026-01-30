import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserGrid } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
import { DataGridQueryParamsProvider } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DataBrowserTableDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const router = useRouter();
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
  } = router;

  const { data: databaseData } = useDatabaseQuery([dataSourceSlug as string], {
    queryOptions: {
      enabled: !!dataSourceSlug && !!schemaSlug && !!tableSlug,
    },
  });

  const isView = [
    ...(databaseData?.views || []),
    ...(databaseData?.materializedViews || []),
  ].some(
    (view) => view.table_schema === schemaSlug && view.table_name === tableSlug,
  );

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <DataGridQueryParamsProvider>
        <DataBrowserGrid isView={isView} />
      </DataGridQueryParamsProvider>
    </RetryableErrorBoundary>
  );
}

DataBrowserTableDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {page}
      </div>
    </OrgLayout>
  );
};
