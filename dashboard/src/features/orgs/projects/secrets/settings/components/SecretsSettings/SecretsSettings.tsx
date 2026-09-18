import { NetworkStatus } from '@apollo/client';
import { Pencil, PlusIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { AppDialog } from '@/components/layout/AppDialog';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
  SettingsTable,
  SettingsTableBody,
  SettingsTableHeader,
  SettingsTableRow,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { IconButton } from '@/components/ui/v3/icon-button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CreateSecretForm } from '@/features/orgs/projects/secrets/settings/components/CreateSecretForm';
import { EditSecretForm } from '@/features/orgs/projects/secrets/settings/components/EditSecretForm';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useDeleteSecretMutation,
  useGetSecretsQuery,
} from '@/generated/graphql';
import type { Secret } from '@/types/application';

export default function SecretsSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  // Still used for the "Apply your changes" follow-up dialog on self-hosted
  // (non-platform) projects, which stays on the old dialog system for now.
  const { openDialog } = useDialog();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreateFormDirty, setIsCreateFormDirty] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditFormDirty, setIsEditFormDirty] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSecret, setDeletingSecret] = useState<Secret | null>(null);

  const { data, error, refetch, networkStatus } = useGetSecretsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const [deleteSecret] = useDeleteSecretMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (networkStatus === NetworkStatus.loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading secrets...
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  async function handleDeleteSecret(secret: Secret) {
    const deleteSecretPromise = deleteSecret({
      variables: {
        appId: project?.id,
        name: secret.name,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await deleteSecretPromise;
        await refetch();

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
        loadingMessage: 'Deleting secret...',
        successMessage: 'Secret has been deleted successfully.',
        errorMessage: 'An error occurred while deleting the secret.',
      },
    );
  }

  function handleOpenCreator() {
    setCreateDialogOpen(true);
  }

  function handleOpenEditor(originalSecret: Secret) {
    setEditingSecret(originalSecret);
    setEditDialogOpen(true);
  }

  function handleConfirmDelete(originalSecret: Secret) {
    setDeletingSecret(originalSecret);
    setDeleteDialogOpen(true);
  }

  const secrets = data?.appSecrets || [];

  return (
    <div className="grid grid-flow-row gap-6">
      <SettingsCard className="gap-0 pb-0">
        <SettingsCardHeader
          // No title here (the page's own H1 already says "Secrets"), so
          // the button stays vertically centered against the description
          // instead of top-aligned against a title that doesn't exist.
          contentClassName="sm:max-w-lg"
          title={null}
          description={
            <span>
              To prevent exposing sensitive information, use secrets in your
              configuration by replacing the actual value with{' '}
              <InlineCode className="rounded-sm py-0.5 text-xs">
                &#123;&#123; secrets.SECRET_NAME &#125;&#125;
              </InlineCode>{' '}
              in any configuration placeholder.
            </span>
          }
          control={
            <Button
              type="button"
              variant="outline-emboss"
              onClick={handleOpenCreator}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Secret
            </Button>
          }
        />

        {secrets.length > 0 && (
          <SettingsCardContent className="mt-6 px-0">
            <SettingsTable>
              <SettingsTableHeader>
                <p className="font-bold">Secret Name</p>
              </SettingsTableHeader>

              <SettingsTableBody>
                {secrets.map((secret) => (
                  <SettingsTableRow
                    key={secret.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <p className="min-w-0 truncate">{secret.name}</p>

                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <IconButton
                            icon={Pencil}
                            aria-label="Edit"
                            onClick={() => handleOpenEditor(secret)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <IconButton
                            icon={Trash2}
                            aria-label="Delete"
                            onClick={() => handleConfirmDelete(secret)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </SettingsTableRow>
                ))}
              </SettingsTableBody>
            </SettingsTable>
          </SettingsCardContent>
        )}

        <AppDialog
          type="form"
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          title="Create Secret"
          isDirty={isCreateFormDirty}
        >
          <CreateSecretForm
            onCancel={() => setCreateDialogOpen(false)}
            onDirtyStateChange={setIsCreateFormDirty}
            onSubmit={async () => {
              await refetch();
              setCreateDialogOpen(false);
            }}
          />
        </AppDialog>

        <AppDialog
          type="form"
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          title="Edit Secret"
          isDirty={isEditFormDirty}
        >
          {editingSecret && (
            <EditSecretForm
              originalSecret={editingSecret}
              onCancel={() => setEditDialogOpen(false)}
              onDirtyStateChange={setIsEditFormDirty}
              onSubmit={async () => setEditDialogOpen(false)}
            />
          )}
        </AppDialog>

        <AppDialog
          type="confirm"
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Secret"
          description={
            deletingSecret && (
              <>
                Are you sure you want to delete the &quot;
                <strong>{deletingSecret.name}</strong>&quot; secret? This
                cannot be undone.
              </>
            )
          }
          destructive
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              if (deletingSecret) {
                handleDeleteSecret(deletingSecret);
              }
            },
          }}
        />
      </SettingsCard>
    </div>
  );
}
