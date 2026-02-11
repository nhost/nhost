import { Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import MetadataConsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataConsistentStatus/MetadataConsistentStatus';
import MetadataInconsistentStatus from '@/features/orgs/projects/graphql/metadata/components/MetadataInconsistentStatus/MetadataInconsistentStatus';
import useGetInconsistentMetadata from '@/features/orgs/projects/graphql/metadata/hooks/useGetInconsistentMetadata/useGetInconsistentMetadata';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function MetadataStatusCard() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
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
          <div className="space-y-1">
            <h3 className="font-medium text-foreground text-sm">
              Unable to fetch metadata status
            </h3>
            <p className="text-muted-foreground text-xs">
              Could not connect to the Hasura endpoint.
            </p>
            <p className="text-muted-foreground text-xs">
              This is usually caused by a CORS or network error. Please check
              that Hasura is running and accessible.
            </p>
            <p className="text-muted-foreground text-xs">
              You can verify your Hasura settings{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                className="text-primary underline"
              >
                here
              </Link>
              .
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
