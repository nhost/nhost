import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsVerticalIcon } from '@/components/ui/v2/icons/DotsVerticalIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { CreateEnvironmentVariableForm } from '@/features/projects/environmentVariables/settings/components/CreateEnvironmentVariableForm';
import { EditEnvironmentVariableForm } from '@/features/projects/environmentVariables/settings/components/EditEnvironmentVariableForm';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import type { EnvironmentVariable } from '@/types/application';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

export interface EnvironmentVariableSettingsFormValues {
  /**
   * Environment variables.
   */
  environmentVariables: EnvironmentVariable[];
}

export default function EnvironmentVariableSettings() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading, error, refetch } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const availableEnvironmentVariables = [
    ...(data?.config?.global?.environment || []),
  ].sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }

    if (a.name > b.name) {
      return 1;
    }

    return 0;
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetEnvironmentVariablesDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleDeleteVariable({ id }: EnvironmentVariable) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          global: {
            environment: availableEnvironmentVariables
              .filter((variable) => variable.id !== id)
              .map((variable) => ({
                name: variable.name,
                value: variable.value,
              })),
          },
        },
      },
    });

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
        loadingMessage: 'Deleting environment variable...',
        successMessage: 'Environment variable has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the environment variable.',
      },
    );
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create Environment Variable',
      component: <CreateEnvironmentVariableForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: EnvironmentVariable) {
    openDialog({
      title: 'Edit Environment Variable',
      component: (
        <EditEnvironmentVariableForm
          originalEnvironmentVariable={originalVariable}
          onSubmit={refetch}
        />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: EnvironmentVariable) {
    openAlertDialog({
      title: 'Delete Environment Variable',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{originalVariable.name}</strong>&quot; environment variable?
          This cannot be undone.
        </Text>
      ),
      props: {
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        onPrimaryAction: () => handleDeleteVariable(originalVariable),
      },
    });
  }

  return (
    <SettingsContainer
      title="Project Environment Variables"
      description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
      docsLink="https://docs.nhost.io/platform/environment-variables"
      docsTitle="Environment Variables"
      rootClassName="gap-0"
      className={twMerge(
        'my-2 px-0',
        availableEnvironmentVariables.length === 0 && 'gap-2',
      )}
      slotProps={{ submitButton: { className: 'hidden' } }}
    >
      <Box className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3 lg:grid-cols-3">
        <Text className="font-medium">Variable Name</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        {availableEnvironmentVariables.length > 0 && (
          <List>
            {availableEnvironmentVariables.map((environmentVariable, index) => (
              <Fragment key={environmentVariable.id}>
                <ListItem.Root
                  className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3"
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
                          onClick={() => handleOpenEditor(environmentVariable)}
                        >
                          <Text className="font-medium">Edit</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          onClick={() =>
                            handleConfirmDelete(environmentVariable)
                          }
                        >
                          <Text className="font-medium" color="error">
                            Delete
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Text className="truncate">
                    {environmentVariable.name}
                  </ListItem.Text>
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === availableEnvironmentVariables.length - 1
                      ? '!mt-4'
                      : '!my-4',
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
          Create Environment Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
