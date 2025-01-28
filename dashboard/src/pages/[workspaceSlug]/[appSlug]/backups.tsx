import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Chip } from '@/components/ui/v2/Chip';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { BackupList } from '@/features/projects/backups/components/BackupList';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { ReactElement } from 'react';

function BackupsContent() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlanFree = currentProject.legacyPlan.isFree;

  if (isPlanFree) {
    return (
      <UpgradeNotification
        message="Unlock backups by upgrading your project to the Pro plan."
        className="mt-4"
      />
    );
  }

  return (
    <div className="mt-6 grid w-full grid-flow-row gap-6">
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
  const { currentProject, loading } = useCurrentWorkspaceAndProject();

  const legacyPlan = currentProject?.legacyPlan;

  if (loading) {
    return <ActivityIndicator label="Loading project..." delay={1000} />;
  }

  return (
    <Container className="max-w-2.5xl">
      <div className="grid grid-flow-col justify-between gap-2">
        <Text className="text-2xl font-medium" variant="h1">
          Backups
        </Text>

        <Chip
          color={legacyPlan.isFree ? 'default' : 'success'}
          label={legacyPlan.isFree ? 'Off' : 'Live'}
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
