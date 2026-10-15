import { createFileRoute } from '@tanstack/react-router';
import { ImportExportMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ImportExportMetadataCard';
import { MetadataStatusCard } from '@/features/orgs/projects/graphql/metadata/components/MetadataStatusCard';
import { ReloadMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ReloadMetadataCard';
import { ResetMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataCard';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/metadata/',
)({
  component: RouteComponent,
});

function MetadataPage() {
  return (
    <div className="grid grid-flow-row gap-y-8 py-8">
      <div>
        <h1 className="font-semibold text-foreground text-lg tracking-tight">
          Metadata
        </h1>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground">
          Manage and reload your metadata to keep your GraphQL schema in sync
          with your data sources.
        </p>
      </div>

      <MetadataStatusCard />
      <ReloadMetadataCard />
      <ImportExportMetadataCard />
      <ResetMetadataCard />
    </div>
  );
}

function RouteComponent() {
  return (
    <div className="flex min-h-full">
      <div className="mx-auto w-full max-w-5xl px-10">
        <MetadataPage />
      </div>
    </div>
  );
}
