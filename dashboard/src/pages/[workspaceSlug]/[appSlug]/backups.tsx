import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { RestoreBackupModal } from '@/features/projects/backups/components/RestoreBackupModal';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetApplicationBackupsQuery } from '@/generated/graphql';
import { Modal } from '@/ui/v1/Modal';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { Chip } from '@/ui/v2/Chip';
import { Text } from '@/ui/v2/Text';
import { prettifySize } from '@/utils/prettifySize';
import { formatDistanceStrict, formatISO9075 } from 'date-fns';
import type { ReactElement } from 'react';
import { useState } from 'react';

export type Backup = {
  id: string;
  createdAt: string;
  size: number;
};

function BackupsHeader() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { plan } = currentProject;
  return (
    <div className="flex flex-row place-content-between">
      <div>
        <Text className="text-2xl font-medium" variant="h1">
          Backups
        </Text>
      </div>

      <Chip
        color={plan.isFree ? 'default' : 'success'}
        label={plan.isFree ? 'Off' : 'Live'}
        size="small"
      />
    </div>
  );
}

function BackupRow({ backup }: any) {
  const { id, createdAt, size } = backup;

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  return (
    <>
      {restoreModalOpen && (
        <Modal
          showModal={restoreModalOpen}
          close={() => setRestoreModalOpen(false)}
          Component={RestoreBackupModal}
          data={{ id, createdAt }}
        />
      )}
      <Box className="flex flex-row place-content-between py-3">
        <Text className="w-drop self-center text-xs font-medium">
          {formatISO9075(new Date(createdAt))}
        </Text>
        <Text className="w-drop self-center text-xs font-medium">
          {prettifySize(size)}
        </Text>
        <Text className="w-drop self-center text-xs font-medium">
          {formatDistanceStrict(new Date(createdAt), new Date(), {
            addSuffix: true,
          })}
        </Text>
        <div className="w-20">
          <Button
            variant="borderless"
            onClick={() => setRestoreModalOpen(true)}
          >
            Restore
          </Button>
        </div>
      </Box>
    </>
  );
}

function BackupsTable() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetApplicationBackupsQuery({
    variables: { appId: currentProject.id },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={500}
        className="my-5"
        label="Loading backups..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const { backups } = data.app;

  return (
    <>
      <Box className="flex flex-row place-content-between border-b-1 py-2">
        <Text className="w-drop text-xs font-bold">Backup</Text>
        <Text className="w-drop text-xs font-bold">Size</Text>
        <Text className="w-drop text-xs font-bold">Backed Up</Text>
        <div className="w-20" />
      </Box>
      <Box className="border-b-1">
        {backups.length === 0 ? (
          <div className="flex flex-row px-1 py-4">
            <Text className="text-xs">No backups yet.</Text>
          </div>
        ) : (
          <div className="divide divide-y-1">
            {backups.map((backup) => (
              <BackupRow key={backup.id} backup={backup} />
            ))}
          </div>
        )}
      </Box>
    </>
  );
}

function SectionContainer({ title }: any) {
  return (
    <div className="mt-6 w-full">
      <Text className="text-lg font-medium">{title}</Text>
      <Text className="font-normal">
        The database backup includes database schema, database data and Hasura
        metadata. It does not include the actual files in Storage.
      </Text>

      <div className="mt-6">
        <BackupsTable />
      </div>
    </div>
  );
}

function BackupsContent() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlanFree = currentProject.plan.isFree;

  if (isPlanFree) {
    return (
      <UpgradeNotification
        message="Unlock backups by upgrading your project to the Pro plan."
        className="mt-4"
      />
    );
  }

  return <SectionContainer title="Database" />;
}

export default function BackupsPage() {
  return (
    <Container className="max-w-2.5xl">
      <BackupsHeader />
      <RetryableErrorBoundary>
        <BackupsContent />
      </RetryableErrorBoundary>
    </Container>
  );
}

BackupsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
