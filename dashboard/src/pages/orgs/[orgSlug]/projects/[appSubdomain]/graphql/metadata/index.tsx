import type { ReactElement } from 'react';
import { Container } from '@/components/layout/Container';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import ExportImportMetadataCard from '@/features/orgs/projects/graphql/metadata/components/ExportImportMetadataCard/ExportImportMetadataCard';
import MetadataStatusCard from '@/features/orgs/projects/graphql/metadata/components/MetadataStatusCard/MetadataStatusCard';
import ReloadMetadataCard from '@/features/orgs/projects/graphql/metadata/components/ReloadMetadataCard/ReloadMetadataCard';
import ResetMetadataCard from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataCard/ResetMetadataCard';

export default function MetadataPage() {
  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <div>
        <h1 className="font-semibold text-foreground text-lg tracking-tight">
          Metadata
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage and reload your metadata to keep your GraphQL schema in sync
          with your data sources.
        </p>
      </div>

      <MetadataStatusCard />
      <ReloadMetadataCard />
      <ExportImportMetadataCard />
      <ResetMetadataCard />
    </Container>
  );
}

MetadataPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
