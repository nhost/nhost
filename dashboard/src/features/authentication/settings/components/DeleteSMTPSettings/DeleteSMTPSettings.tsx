import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  GetSmtpSettingsDocument,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ConfirmDeleteSMTPSettingsModal({
  close,
  onDelete,
}: {
  onDelete?: () => Promise<any>;
  close: () => void;
}) {
  const onClickDelete = async () => {
    await onDelete();
    close();
  };

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-4">
        <Text variant="h3" component="h2">
          Delete SMTP Settings?
        </Text>

        <Text>This will reset all your SMTP and Postmark settings.</Text>

        <div className="grid grid-flow-row gap-2">
          <Button color="error" onClick={onClickDelete}>
            Delete
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

export default function DeleteSMTPSettings() {
  const { openDialog, closeDialog } = useDialog();

  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { maintenanceActive } = useUI();
  const [loading, setLoading] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSmtpSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const deleteSMTPSettings = async () => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          provider: {
            smtp: null,
          },
        },
      },
    });

    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'SMTP settings are being deleted...',
        successMessage: 'SMTP settings have been deleted successfully.',
        errorMessage:
          'An error occurred while trying to delete the SMTP settings.',
      },
    );

    setLoading(false);
  };

  const confirmDeleteSMTPSettings = async () => {
    openDialog({
      component: (
        <ConfirmDeleteSMTPSettingsModal
          close={closeDialog}
          onDelete={deleteSMTPSettings}
        />
      ),
    });
  };

  return (
    <SettingsContainer
      title="Delete SMTP Settings"
      description="Delete SMTP settings and revert to default values"
      className="px-0"
      slotProps={{
        submitButton: { className: 'hidden' },
        footer: { className: 'hidden' },
      }}
    >
      <Box className="grid grid-flow-row border-t-1">
        <Button
          color="error"
          className="mx-4 mt-4 justify-self-end"
          onClick={confirmDeleteSMTPSettings}
          disabled={loading || maintenanceActive}
          loading={loading}
        >
          Delete
        </Button>
      </Box>
    </SettingsContainer>
  );
}
