import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { Backup } from '@/types/application';
import { useRestoreApplicationDatabaseMutation } from '@/utils/__generated__/graphql';
import { triggerToast } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';

export interface RestoreBackupModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: VoidFunction;
  /**
   * Backup data.
   */
  backup: Backup;
}

export default function RestoreBackupModal({
  close,
  backup,
}: RestoreBackupModalProps) {
  const { id: backupId, createdAt } = backup;

  const [isSure, setIsSure] = useState(false);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [restoreApplicationDatabase, { loading }] =
    useRestoreApplicationDatabaseMutation();

  async function handleSubmit() {
    setRestoreCompleted(false);
    try {
      await restoreApplicationDatabase({
        variables: {
          backupId,
          appId: currentProject.id,
        },
      });
    } catch (error) {
      setRestoreCompleted(false);
      triggerToast('Database backup restoration failed');
      return;
    }
    setRestoreCompleted(true);
    triggerToast('Database backup successfully scheduled for restoration.');
  }

  if (restoreCompleted) {
    return (
      <Box className="grid grid-flow-row gap-4 px-6 pb-6">
        <Text>The backup has been restored successfully.</Text>

        <Button onClick={close}>OK</Button>
      </Box>
    );
  }

  return (
    <Box className="grid grid-flow-row gap-2 px-6 pb-6">
      <Text>
        You current database will be deleted, and the backup created at{' '}
        <span className="font-semibold">
          {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
        </span>{' '}
        will be restored.
      </Text>

      <Box className="pb-2.5 pt-1">
        <Checkbox
          checked={isSure}
          onChange={(_event, checked) => setIsSure(checked)}
          label="I'm sure I want to restore this backup"
        />
      </Box>

      <Button onClick={handleSubmit} disabled={!isSure} loading={loading}>
        Restore
      </Button>

      <Button variant="outlined" color="secondary" onClick={close}>
        Cancel
      </Button>
    </Box>
  );
}
