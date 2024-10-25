import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Chip } from '@/components/ui/v2/Chip';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { BackupList } from '@/features/orgs/projects/backups/components/BackupList';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import type { ReactElement } from 'react';

function BackupsContent() {
  return (
    <div className="grid w-full grid-flow-row gap-6 mt-6">
      <div>
        <Text className="font-medium">Database</Text>
        <Text color="secondary">
          The database backup includes database schema, database data and Hasura
          metadata. It does not include the actual files in Storage.
        </Text>
      </div>

      <BackupList />
    </div>
  );
}

export default function BackupsPage() {
  const { currentOrg: org, loading } = useOrgs();
  const isPlanFree = org.plan.isFree;

  if (loading) {
    return <ActivityIndicator label="Loading project..." delay={1000} />;
  }

  if (isPlanFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Database Backups, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    )
  }


  return (
    <Container className="grid max-w-5xl grid-flow-row bg-transparent gap-y-6">
      <div className="grid justify-between grid-flow-col gap-2">
        <Text className="text-2xl font-medium" variant="h1">
          Backups
        </Text>

        <Chip
          color={org?.plan.isFree ? 'default' : 'success'}
          label={org?.plan.isFree ? 'Off' : 'Live'}
          size="small"
        />
      </div>

      <RetryableErrorBoundary>
        <BackupsContent />
      </RetryableErrorBoundary>
    </Container>
  );
}

BackupsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
