import { NetworkStatus } from '@apollo/client';
import { EllipsisVertical as DotsVerticalIcon, PlusIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Fragment, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
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
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{originalSecret.name}</strong>&quot; secret? This cannot be
          undone.
        </Text>
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
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <SettingsContainer
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
        rootClassName="gap-0 pb-0"
        className={twMerge('my-2 px-0', secrets.length === 0 && 'gap-2')}
        slotProps={{
          submitButton: { className: 'hidden' },
          footer: { className: 'hidden' },
        }}
      >
        <Box className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3">
          <Text className="font-medium">Secret Name</Text>
        </Box>

        <Box className="grid grid-flow-row gap-2">
          {secrets.length > 0 && (
            <List>
              {secrets.map((secret, index) => (
                <Fragment key={secret.name}>
                  <ListItem.Root
                    className="grid grid-cols-2 gap-2 px-4"
                    secondaryAction={
                      <DropdownMenu
                        open={openActionMenuSecret === secret.name}
                        onOpenChange={(open) =>
                          setOpenActionMenuSecret(
                            open ? secret.name : undefined,
                          )
                        }
                      >
                        <DropdownMenuTrigger
                          asChild
                          className="absolute top-1/2 right-4 -translate-y-1/2"
                        >
                          <IconButton variant="borderless" color="secondary">
                            <DotsVerticalIcon />
                          </IconButton>
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
                    }
                  >
                    <ListItem.Text className="truncate">
                      {secret.name}
                    </ListItem.Text>
                  </ListItem.Root>

                  <Divider
                    component="li"
                    className={twMerge(
                      index === secrets.length - 1 ? '!mt-4' : '!my-4',
                    )}
                  />
                </Fragment>
              ))}
            </List>
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
        </Box>
      </SettingsContainer>
    </Container>
  );
}

SecretsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full overflow-auto',
      }}
    >
      <SettingsLayout>
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </OrgLayout>
  );
};
