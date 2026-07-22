import { EllipsisVertical as DotsVerticalIcon, PlusIcon } from 'lucide-react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
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
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/CreateEnvironmentVariableForm';
import { EditEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditEnvironmentVariableForm';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { EnvironmentVariable } from '@/types/application';
import {
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';

export interface EnvironmentVariableSettingsFormValues {
  /**
   * Environment variables.
   */
  environmentVariables: EnvironmentVariable[];
}

export default function EnvironmentVariableSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, error, refetch } = useGetEnvironmentVariablesQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
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
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  async function handleDeleteVariable({ id }: EnvironmentVariable) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
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
      docsLink="https://docs.nhost.io/platform/cloud/environment-variables"
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
                    <DropdownMenu>
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
                          onClick={() => handleOpenEditor(environmentVariable)}
                          className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() =>
                            handleConfirmDelete(environmentVariable)
                          }
                          className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          type="button"
          variant="ghost"
          className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
          onClick={handleOpenCreator}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Environment Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
