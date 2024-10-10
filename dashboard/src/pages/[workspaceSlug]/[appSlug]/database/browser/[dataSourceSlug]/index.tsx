import { InlineCode } from '@/components/presentational/InlineCode';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { DataBrowserEmptyState } from '@/features/database/dataGrid/components/DataBrowserEmptyState';
import { DataBrowserSidebar } from '@/features/database/dataGrid/components/DataBrowserSidebar';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
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
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <DataBrowserSidebar className="w-full max-w-sidebar" />

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
      </Box>
    </ProjectLayout>
  );
};
