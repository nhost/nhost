import { RestoreBackupModal } from '@/components/applications/RestoreBackupModal';
import { UnlockFeatureByUpgrading } from '@/components/applications/UnlockFeatureByUpgrading';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useGetApplicationBackupsQuery } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Modal } from '@/ui';
import DelayedLoading from '@/ui/DelayedLoading';
import Status, { StatusEnum } from '@/ui/Status';
import { Text } from '@/ui/Text/Text';
import Button from '@/ui/v2/Button';
import { formatDistanceStrict, formatISO9075 } from 'date-fns';
import prettysize from 'prettysize';
import type { ReactElement } from 'react';
import { useState } from 'react';

export type Backup = {
  id: string;
  createdAt: string;
  size: number;
};

function BackupsHeader() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { plan } = currentApplication;
  return (
    <div className="flex flex-row place-content-between">
      <div>
        <Text color="greyscaleDark" className="font-medium" size="big">
          Backups
        </Text>
      </div>
      <div className="relative top-1.5 mr-2 self-center align-middle">
        {plan.isFree ? (
          <Status status={StatusEnum.Closed}>Off</Status>
        ) : (
          <Status status={StatusEnum.Live}>Live</Status>
        )}
      </div>
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
      <div className="flex flex-row place-content-between py-3">
        <Text
          color="greyscaleDark"
          size="tiny"
          className="w-drop self-center font-medium"
        >
          {formatISO9075(new Date(createdAt))}
        </Text>
        <Text
          color="greyscaleDark"
          size="tiny"
          className="w-drop self-center font-medium"
        >
          {prettysize(size)}
        </Text>
        <Text
          color="greyscaleDark"
          size="tiny"
          className="w-drop self-center font-medium"
        >
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
      </div>
    </>
  );
}

function BackupsTable() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetApplicationBackupsQuery({
    variables: { appId: currentApplication.id },
  });

  if (loading) {
    return <DelayedLoading className="my-5" delay={500} />;
  }

  if (error) {
    throw error;
  }

  const { backups } = data.app;

  return (
    <>
      <div className="flex flex-row place-content-between border-b-1 py-2">
        <Text color="greyscaleDark" size="tiny" className="w-drop font-bold">
          Backup
        </Text>
        <Text color="greyscaleDark" size="tiny" className="w-drop font-bold">
          Size
        </Text>
        <Text color="greyscaleDark" size="tiny" className="w-drop font-bold">
          Backed Up
        </Text>
        <div className="w-20" />
      </div>
      <div className="border-b-1">
        {backups.length === 0 ? (
          <div className="flex flex-row px-1 py-4">
            <Text size="tiny" className="self-center" color="greyscaleGrey">
              No backups yet.
            </Text>
          </div>
        ) : (
          <div className="divide divide-y-1">
            {backups.map((backup) => (
              <BackupRow key={backup.id} backup={backup} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SectionContainer({ title }: any) {
  return (
    <div className="mt-6 w-full">
      <Text color="greyscaleDark" className="font-medium" size="large">
        {title}
      </Text>
      <Text color="greyscaleDark" className="my-2 font-normal" size="normal">
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
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isPlanFree = currentApplication.plan.isFree;

  if (isPlanFree) {
    return (
      <UnlockFeatureByUpgrading
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
