import { InlineCode } from '@/components/presentational/InlineCode';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
// import { DataBrowserLayout } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserLayout';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function DataBrowserDatabaseDetailsPage() {
  const {
    query: { dataSourceSlug },
  } = useRouter();

  if (dataSourceSlug !== 'default') {
    return (
      <DataBrowserEmptyState
        title="Database not found"
        description={
          <span>
            Database{' '}
            <InlineCode className="px-1.5 text-sm">{dataSourceSlug}</InlineCode>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return (
    <DataBrowserEmptyState
      title="Database"
      description="Select a table from the sidebar to get started."
    />
  );
}

DataBrowserDatabaseDetailsPage.getLayout = function getLayout(
  page: ReactElement,
) {
  return (
    <ProjectLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
    </ProjectLayout>
  );
};
