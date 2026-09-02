import type { ReactElement } from 'react';
import { getGraphQLLayout } from '@/features/orgs/projects/graphql/layout';
import { ImportExportMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ImportExportMetadataCard';
import { MetadataStatusCard } from '@/features/orgs/projects/graphql/metadata/components/MetadataStatusCard';
import { ReloadMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ReloadMetadataCard';
import { ResetMetadataCard } from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataCard';

export default function MetadataPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-flow-row gap-y-8 px-10 py-8">
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

MetadataPage.getLayout = function getLayout(page: ReactElement) {
  return getGraphQLLayout(page, {
    bodyClassName: 'bg-background-default',
    contentClassName: 'bg-background-default',
  });
};
