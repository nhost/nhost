import { NetworkStatus } from '@apollo/client';
import { EllipsisVertical as DotsVerticalIcon, PlusIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Fragment, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { InlineCode } from '@/components/presentational/InlineCode';

import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
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

export default function SecretsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();
  const [openActionMenuSecret, setOpenActionMenuSecret] = useState<
    string | undefined
  >();

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
      title: 'Create Secret',
      component: <CreateSecretForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-md' },
      },
    });
  }

  function handleOpenEditor(originalSecret: Secret) {
    openDialog({
      title: 'Edit Secret',
      component: <EditSecretForm originalSecret={originalSecret} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-md' },
      },
    });
  }

  function handleConfirmDelete(originalSecret: Secret) {
    openAlertDialog({
      title: 'Delete Secret',
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
      <SettingsCard className="gap-0 pb-0">
        <SettingsCardHeader
          title="Secrets"
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
        />

        <SettingsCardContent
          className={twMerge('my-2 px-0', secrets.length === 0 && 'gap-2')}
        >
          <div className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3">
            <p className="font-medium">Secret Name</p>
          </div>

          <div className="grid grid-flow-row gap-2">
            {secrets.length > 0 && (
              <div>
                {secrets.map((secret, index) => (
                  <Fragment key={secret.name}>
                    <div className="relative grid grid-cols-2 gap-2 px-4 pr-12">
                      <DropdownMenu
                        open={openActionMenuSecret === secret.name}
                        onOpenChange={(open) =>
                          setOpenActionMenuSecret(
                            open ? secret.name : undefined,
                          )
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1/2 right-4 -translate-y-1/2"
                          >
                            <DotsVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-32 p-0">
                          <DropdownMenuItem
                            className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                            onClick={() => {
                              setOpenActionMenuSecret(undefined);
                              handleOpenEditor(secret);
                            }}
                          >
                            <span>Edit</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setOpenActionMenuSecret(undefined);
                              handleConfirmDelete(secret);
                            }}
                            className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                          >
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <p className="truncate">{secret.name}</p>
                    </div>

                    <div
                      className={twMerge(
                        'border-t',
                        index === secrets.length - 1 ? '!mt-4' : '!my-4',
                      )}
                    />
                  </Fragment>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
              onClick={handleOpenCreator}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Secret
            </Button>
          </div>
        </SettingsCardContent>
      </SettingsCard>
    </div>
  );
}

SecretsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};
