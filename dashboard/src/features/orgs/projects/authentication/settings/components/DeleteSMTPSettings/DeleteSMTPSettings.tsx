import { useState } from 'react';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

function ConfirmDeleteSMTPSettingsModal({
  close,
  onDelete,
}: {
  onDelete: () => Promise<unknown>;
  close: () => void;
}) {
  const onClickDelete = async () => {
    await onDelete();
    close();
  };

  return (
    <div className="w-full rounded-lg p-6 text-left">
      <div className="grid grid-flow-row gap-4">
        <h2 className="font-semibold text-lg">Delete SMTP Settings?</h2>

        <p className="text-muted-foreground">
          This will reset all your SMTP and Postmark settings.
        </p>

        <div className="grid grid-flow-row gap-2">
          <Button variant="destructive" onClick={onClickDelete}>
            Delete
          </Button>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DeleteSMTPSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const [loading, setLoading] = useState(false);
  const { openDialog, closeDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();

  const { data, refetch } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const smtpSettings = data?.config?.provider?.smtp ?? {};

  const isSMTPConfigured = Boolean(Object.keys(smtpSettings).length);

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const deleteSMTPSettings = async () => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
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
          onDelete={async () => {
            await deleteSMTPSettings();
            await refetch();
          }}
        />
      ),
    });
  };

  return (
    <SettingsCard>
      <SettingsCardHeader
        title="Delete SMTP Settings"
        description="Delete SMTP settings and revert to default values"
      />

      <SettingsCardContent className="px-0">
        <div className="grid grid-flow-row border-t">
          <ButtonWithLoading
            variant="destructive"
            className="mx-4 mt-4 justify-self-end"
            onClick={confirmDeleteSMTPSettings}
            disabled={loading || !isSMTPConfigured}
            loading={loading}
          >
            Delete
          </ButtonWithLoading>
        </div>
      </SettingsCardContent>
    </SettingsCard>
  );
}
