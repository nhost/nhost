import { Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { MetadataConsistentStatus } from '@/features/orgs/projects/graphql/metadata/components/MetadataConsistentStatus';
import { MetadataInconsistentStatus } from '@/features/orgs/projects/graphql/metadata/components/MetadataInconsistentStatus';
import { useGetInconsistentMetadata } from '@/features/orgs/projects/graphql/metadata/hooks/useGetInconsistentMetadata';
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
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-muted-foreground">
            <h4 className="font-medium text-foreground">
              Unable to fetch metadata status
            </h4>
            <p className="max-w-prose text-pretty">
              Please check that Hasura is running and accessible.
            </p>
            <p>
              You can verify the{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                className="text-primary underline"
              >
                Hasura settings page
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
