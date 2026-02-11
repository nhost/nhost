import { Loader2, TriangleAlert } from 'lucide-react';
import MetadataConsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataConsistentStatus/MetadataConsistentStatus';
import MetadataInconsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataInconsistentStatus/MetadataInconsistentStatus';
import useGetInconsistentMetadata from '@/features/orgs/projects/graphql/metadata/hooks/useGetInconsistentMetadata/useGetInconsistentMetadata';

export default function MetadataStatusCard() {
  const {
    data: metadataStatus,
    isLoading,
    isError,
  } = useGetInconsistentMetadata();

  const inconsistentObjects = metadataStatus?.inconsistent_objects ?? [];
  const isMetadataConsistent = Boolean(metadataStatus?.is_consistent);

  if (isLoading && !isError) {
    return (
      <div className="rounded-lg border bg-paper p-6">
        <div className="flex w-full items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border bg-paper p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-foreground text-sm">
              Unable to fetch metadata status
            </h3>
            <p className="text-muted-foreground text-xs">
              Could not connect to the Hasura endpoint. This is usually caused
              by a CORS or network error. Please check that Hasura is running
              and accessible.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-paper p-6">
      {isMetadataConsistent ? (
        <MetadataConsistentStatus />
      ) : (
        <MetadataInconsistentStatus inconsistentObjects={inconsistentObjects} />
      )}
    </div>
  );
}
