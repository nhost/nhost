import { useDialog } from '@/components/common/DialogProvider';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import CreateSecretForm from '@/components/settings/secrets/CreateSecretForm';
import EditSecretForm from '@/components/settings/secrets/EditSecretForm';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { Secret } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import {
  GetSecretsDocument,
  useDeleteSecretMutation,
  useGetSecretsQuery,
} from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import type { ReactElement } from 'react';
import { Fragment } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export default function SecretsPage() {
  const { openDialog, openAlertDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetSecretsQuery({
    variables: { appId: currentProject?.id },
  });

  const [deleteSecret] = useDeleteSecretMutation({
    refetchQueries: [GetSecretsDocument],
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading secrets..." />;
  }

  if (error) {
    throw error;
  }

  async function handleDeleteSecret(secret: Secret) {
    const deleteSecretPromise = deleteSecret({
      variables: {
        appId: currentProject?.id,
        name: secret.name,
      },
    });

    try {
      await toast.promise(
        deleteSecretPromise,
        {
          loading: 'Deleting secret...',
          success: 'Secret has been deleted successfully.',
          error: (arg: Error) =>
            arg?.message
              ? `Error: ${arg?.message}`
              : 'An error occurred while deleting the secret.',
        },
        getToastStyleProps(),
      );
    } catch (deleteSecretError) {
      console.error(deleteSecretError);
    }
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create Secret',
      component: <CreateSecretForm />,
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
        description="Secrets are key-value pairs configured outside your source code. TBD."
        docsLink="https://docs.nhost.io/platform/environment-variables"
        docsTitle="Secrets"
        rootClassName="gap-0"
        className={twMerge('my-2 px-0', secrets.length === 0 && 'gap-2')}
        slotProps={{ submitButton: { className: 'hidden' } }}
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
                      <Dropdown.Root>
                        <Dropdown.Trigger
                          asChild
                          hideChevron
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          <IconButton
                            variant="borderless"
                            color="secondary"
                            disabled={maintenanceActive}
                          >
                            <DotsVerticalIcon />
                          </IconButton>
                        </Dropdown.Trigger>

                        <Dropdown.Content
                          menu
                          PaperProps={{ className: 'w-32' }}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                          }}
                        >
                          <Dropdown.Item
                            onClick={() => handleOpenEditor(secret)}
                          >
                            <Text className="font-medium">Edit</Text>
                          </Dropdown.Item>

                          <Divider component="li" />

                          <Dropdown.Item
                            onClick={() => handleConfirmDelete(secret)}
                          >
                            <Text
                              className="font-medium"
                              sx={{
                                color: (theme) => theme.palette.error.main,
                              }}
                            >
                              Delete
                            </Text>
                          </Dropdown.Item>
                        </Dropdown.Content>
                      </Dropdown.Root>
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
            className="mx-4 justify-self-start"
            variant="borderless"
            startIcon={<PlusIcon />}
            onClick={handleOpenCreator}
            disabled={maintenanceActive}
          >
            Create Secret
          </Button>
        </Box>
      </SettingsContainer>
    </Container>
  );
}

SecretsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
