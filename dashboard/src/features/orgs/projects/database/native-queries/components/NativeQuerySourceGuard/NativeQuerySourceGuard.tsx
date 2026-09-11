import type { PropsWithChildren } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';

export default function NativeQuerySourceGuard({
  source,
  children,
}: PropsWithChildren<{ source: string }>) {
  const {
    data: sources,
    isLoading,
    error,
  } = useExportMetadata((data) => data.metadata.sources ?? []);

  if (error) {
    return (
      <NativeQueriesEmptyState
        title="Could not load data sources"
        description="Metadata could not be loaded. Please try again."
      />
    );
  }

  if (isLoading || !source) {
    return <LoadingScreen />;
  }

  const selectedSource = sources?.find((item) => item.name === source);
  if (!selectedSource) {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={`Database ${source} does not exist or is no longer available.`}
      />
    );
  }

  if (selectedSource.kind !== 'postgres') {
    return (
      <NativeQueriesEmptyState
        title="Unsupported data source"
        description="Native queries are only supported for PostgreSQL data sources."
      />
    );
  }

  return children;
}
