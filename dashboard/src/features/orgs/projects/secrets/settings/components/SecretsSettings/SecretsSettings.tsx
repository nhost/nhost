import { NetworkStatus } from '@apollo/client';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
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
  const { openDialog, openAlertDialog } = useDialog();

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
    openDialog({
      title: 'Create secret',
      component: <CreateSecretForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-xl' },
      },
    });
  }

  function handleOpenEditor(originalSecret: Secret) {
    openDialog({
      title: `Replace ${originalSecret.name}`,
      component: <EditSecretForm originalSecret={originalSecret} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-xl' },
      },
    });
  }

  function handleConfirmDelete(originalSecret: Secret) {
    openAlertDialog({
      title: 'Delete secret',
      payload: (
        <p>
          Are you sure you want to delete the &quot;
          <strong>{originalSecret.name}</strong>&quot; secret? This cannot be
          undone.
        </p>
      ),
      props: {
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        onPrimaryAction: () => handleDeleteSecret(originalSecret),
      },
    });
  }

  const secrets = data?.appSecrets || [];

  return (
    <div className="grid grid-flow-row gap-6">
      <SettingsCard>
        <SettingsCardHeader
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
          actions={
            <Button type="button" variant="outline" onClick={handleOpenCreator}>
              <PlusIcon className="mr-2" />
              Create secret
            </Button>
          }
        />

        {secrets.length > 0 && (
          <SettingsCardContent className="mt-2">
            <VariableGroup>
              {secrets.map((secret) => (
                <TableRow key={secret.name} className="group">
                  <TableCell className="break-all font-mono">
                    {secret.name}
                  </TableCell>
                  <TableCell className="w-24">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="subtle"
                            aria-label={`Replace ${secret.name}`}
                            onClick={() => handleOpenEditor(secret)}
                          >
                            <PencilIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Replace value</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="subtle"
                            className="hover:text-destructive dark:hover:text-destructive"
                            aria-label={`Delete ${secret.name}`}
                            onClick={() => handleConfirmDelete(secret)}
                          >
                            <Trash2Icon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </VariableGroup>
          </SettingsCardContent>
        )}
      </SettingsCard>
    </div>
  );
}
