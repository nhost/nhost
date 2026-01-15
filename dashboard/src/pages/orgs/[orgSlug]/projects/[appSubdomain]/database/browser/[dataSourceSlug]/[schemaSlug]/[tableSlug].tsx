import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserGrid } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid';
import { DataGridQueryParamsProvider } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import FunctionDefinitionView from '@/features/orgs/projects/database/dataGrid/components/FunctionDefinitionView';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

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

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  // Check if the current object is a function
  const isFunction =
    databaseData?.functions?.some(
      (func) =>
        func.table_schema === schemaSlug && func.table_name === tableSlug,
    ) || false;

  return (
    <RetryableErrorBoundary>
      {isFunction ? (
        <FunctionDefinitionView />
      ) : (
        <DataGridQueryParamsProvider>
          <DataBrowserGrid />
        </DataGridQueryParamsProvider>
      )}
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
