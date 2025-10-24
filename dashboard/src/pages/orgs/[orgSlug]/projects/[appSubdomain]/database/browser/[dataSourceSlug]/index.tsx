import { InlineCode } from '@/components/presentational/InlineCode';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
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
