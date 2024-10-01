import { InlineCode } from '@/components/presentational/InlineCode';
import { DataBrowserEmptyState } from '@/features/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserLayout } from '@/features/database/dataGrid/components/DataBrowserLayout';
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
  return <DataBrowserLayout>{page}</DataBrowserLayout>;
};
