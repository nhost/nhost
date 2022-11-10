import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Button } from '@/ui/Button';
import CheckBoxes from '@/ui/Checkboxes';
import { Text } from '@/ui/Text';
import { triggerToast } from '@/utils/toast';
import { useRestoreApplicationDatabaseMutation } from '@/utils/__generated__/graphql';
import { formatISO9075 } from 'date-fns';
import { useState } from 'react';

export interface RestoreBackupModalModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: any;
  /**
   * Arbitrary data passed down to the modal.
   *
   */
  data: any;
}

export function RestoreBackupModal({
  close,
  data,
}: RestoreBackupModalModalProps) {
  const { id: backupId, createdAt } = data;

  const [isSure, setIsSure] = useState(false);
  const [mutationIsCompleted, setMutationIsCompleted] = useState(false);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const [restoreApplicationDatabase, { loading }] =
    useRestoreApplicationDatabaseMutation();

  const handleSubmit = async () => {
    setMutationIsCompleted(false);
    try {
      await restoreApplicationDatabase({
        variables: {
          backupId,
          appId: currentApplication.id,
        },
      });
    } catch (error) {
      setMutationIsCompleted(false);
      triggerToast('Database backup restoration failed');
      return;
    }
    setMutationIsCompleted(true);
    triggerToast('Database backup successfully scheduled for restoration.');
  };

  if (mutationIsCompleted) {
    return (
      <div className="w-modal p-6">
        <div className="flex flex-col">
          <Text
            variant="subHeading"
            color="greyscaleDark"
            size="large"
            className="text-center"
          >
            The backup has been restored successfully
          </Text>

          <Button variant="primary" className="mt-5" onClick={close}>
            OK
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-modal px-6 py-6 text-left">
      <div className="flex flex-col">
        <Text
          variant="subHeading"
          color="greyscaleDark"
          size="large"
          className="text-center"
        >
          Restore Database Backup
        </Text>
        <Text
          variant="body"
          color="greyscaleDark"
          size="small"
          className="mt-2 text-center font-normal"
        >
          You current database will be deleted, and the backup created{' '}
          <span className="font-semibold">
            {formatISO9075(new Date(createdAt))}
          </span>{' '}
          will be restored.
        </Text>

        <div className="my-4 divide-y-1 border-t border-b px-2">
          <CheckBoxes
            id="accept-restore"
            state={isSure}
            setState={setIsSure}
            checkBoxText="I'm sure I want to restore this backup."
          />
        </div>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isSure}
          loading={loading}
        >
          Restore this database backup
        </Button>
      </div>
    </div>
  );
}
