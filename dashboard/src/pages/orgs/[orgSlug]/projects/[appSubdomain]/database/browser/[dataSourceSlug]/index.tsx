import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { InlineCode } from '@/components/presentational/InlineCode';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';

function DataBrowserDatabaseDetailsContent() {
  const {
    query: { dataSourceSlug },
  } = useRouter();

  const { status, error } = useDatabaseQuery([dataSourceSlug as string]);

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

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === 'error') {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  return (
    <DataBrowserEmptyState
      title="Database"
      description="Select a table from the sidebar to get started."
    />
  );
}

export default function DataBrowserDatabaseDetailsPage() {
  return (
    <RetryableErrorBoundary>
      <DataBrowserDatabaseDetailsContent />
    </RetryableErrorBoundary>
  );
}

DataBrowserDatabaseDetailsPage.getLayout = function getLayout(
  page: ReactElement,
) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden bg-default">
        {page}
      </div>
    </OrgLayout>
  );
};
