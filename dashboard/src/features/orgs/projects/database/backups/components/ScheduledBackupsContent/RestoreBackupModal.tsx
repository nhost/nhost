import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRestoreApplicationDatabase } from '@/features/orgs/hooks/useRestoreApplicationDatabase';
import {
  BACKUP_OPERATION_COPY,
  type BackupOperation,
} from '@/features/orgs/projects/database/backups/components/common/backup-operation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import type { Backup } from '@/types/application';

export interface RestoreBackupModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: VoidFunction;
  /**
   * Backup data.
   */
  backup: Backup;
  sourceAppId: string;
  sourceProjectName?: string;
  operation?: BackupOperation;
}

export default function RestoreBackupModal({
  close,
  backup,
  sourceAppId,
  sourceProjectName,
  operation = 'restore',
}: RestoreBackupModalProps) {
  const { id: backupId, createdAt } = backup;

  const [isSure, setIsSure] = useState(false);
  const [isRestoreCompleted, setIsRestoreCompleted] = useState(false);
  const { project } = useProject();
  const track = useTrackEvent();

  const { restoreApplicationDatabase, loading } =
    useRestoreApplicationDatabase();
  const operationCopy = BACKUP_OPERATION_COPY[operation].backupList;
  const { toastMessages } = operationCopy;

  async function handleSubmit() {
    if (!project?.id) {
      return;
    }

    await restoreApplicationDatabase(
      {
        backupId,
        appId: project.id,
        fromAppId: sourceAppId === project.id ? null : sourceAppId,
      },
      () => {
        track('Backup Restored');
        setIsRestoreCompleted(true);
      },
      toastMessages,
    );
  }

  if (isRestoreCompleted) {
    return (
      <div className="grid grid-flow-row gap-2 px-12 pb-12">
        <p className="text-muted-foreground text-sm">
          {operationCopy.completedMessage}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-flow-row gap-2 px-12 pb-12">
      {sourceAppId === project?.id ? (
        <p className="text-muted-foreground text-sm">
          Your current database will be deleted, and the backup created at{' '}
          <span className="font-semibold">
            {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </span>{' '}
          will be restored.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          The current database in{' '}
          <span className="font-semibold">{project?.name}</span> will be deleted
          and replaced with the backup created at{' '}
          <span className="font-semibold">
            {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </span>{' '}
          from{' '}
          <span className="font-semibold">
            {sourceProjectName ?? 'the selected source project'}
          </span>
          .
        </p>
      )}

      <div className="pt-1 pb-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id="restore-confirm"
            checked={isSure}
            onCheckedChange={(checked) => setIsSure(checked === true)}
          />
          <Label
            htmlFor="restore-confirm"
            className="cursor-pointer font-normal"
          >
            {operationCopy.confirmationCheckboxLabel}
          </Label>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <ButtonWithLoading
          onClick={handleSubmit}
          disabled={!isSure}
          loading={loading}
        >
          {operationCopy.submitButtonText}
        </ButtonWithLoading>
      </div>
    </div>
  );
}
