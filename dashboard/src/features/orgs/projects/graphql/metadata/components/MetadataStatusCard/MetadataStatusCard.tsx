import { Loader2 } from 'lucide-react';
import MetadataConsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataConsistentStatus/MetadataConsistentStatus';
import MetadataInconsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataInconsistentStatus/MetadataInconsistentStatus';
import useGetInconsistentMetadata from '@/features/orgs/projects/graphql/metadata/hooks/useGetInconsistentMetadata/useGetInconsistentMetadata';

export default function MetadataStatusCard() {
  const { data: metadataStatus, isLoading } = useGetInconsistentMetadata();

  const inconsistentObjects = metadataStatus?.inconsistent_objects ?? [];
  const hasInconsistencies =
    metadataStatus?.is_consistent === false || inconsistentObjects.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex w-full items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      {hasInconsistencies ? (
        <MetadataInconsistentStatus inconsistentObjects={inconsistentObjects} />
      ) : (
        <MetadataConsistentStatus />
      )}
    </div>
  );
}
