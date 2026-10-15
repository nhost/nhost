import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/',
)({
  component: DataBrowserDatabaseDetailsPage,
});

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

function DataBrowserDatabaseDetailsPage() {
  return (
    <RetryableErrorBoundary>
      <DataBrowserDatabaseDetailsContent />
    </RetryableErrorBoundary>
  );
}
