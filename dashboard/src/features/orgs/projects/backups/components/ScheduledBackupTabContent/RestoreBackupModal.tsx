import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRestoreApplicationDatabase } from '@/features/orgs/hooks/useRestoreApplicationDatabase';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
  dialogTitle?: string;
  submitButtonText?: string;
}

export default function RestoreBackupModal({
  close,
  backup,
  sourceAppId,
  sourceProjectName,
  submitButtonText = 'Restore',
}: RestoreBackupModalProps) {
  const { id: backupId, createdAt } = backup;

  const [isSure, setIsSure] = useState(false);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const { project } = useProject();

  const { restoreApplicationDatabase, loading } =
    useRestoreApplicationDatabase();

  async function handleSubmit() {
    if (!project?.id) {
      return;
    }

    setRestoreCompleted(false);
    await restoreApplicationDatabase(
      {
        backupId,
        appId: project.id,
        fromAppId: sourceAppId === project.id ? null : sourceAppId,
      },
      () => setRestoreCompleted(true),
    );
  }

  if (restoreCompleted) {
    return (
      <div className="grid grid-flow-row gap-4 px-6 pb-6">
        <p>The backup has been restored successfully.</p>

        <Button onClick={close}>OK</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-flow-row gap-2 px-6 pb-6">
      {sourceAppId === project?.id ? (
        <p>
          You current database will be deleted, and the backup created at{' '}
          <span className="font-semibold">
            {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </span>{' '}
          will be restored.
        </p>
      ) : (
        <p>
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
            I'm sure I want to restore this backup
          </Label>
        </div>
      </div>

      <ButtonWithLoading
        onClick={handleSubmit}
        disabled={!isSure}
        loading={loading}
      >
        {submitButtonText}
      </ButtonWithLoading>

      <Button variant="outline" onClick={close}>
        Cancel
      </Button>
    </div>
  );
}
