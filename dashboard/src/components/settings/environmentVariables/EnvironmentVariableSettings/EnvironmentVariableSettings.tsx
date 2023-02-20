import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { EnvironmentVariable } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useDeleteEnvironmentVariableMutation,
  useGetEnvironmentVariablesQuery,
} from '@/utils/__generated__/graphql';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  environmentVariables: EnvironmentVariable[];
}

export default function EnvironmentVariableSettings() {
  const { openDialog, openAlertDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const [deleteEnvironmentVariable] = useDeleteEnvironmentVariableMutation({
    refetchQueries: ['getEnvironmentVariables'],
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
    const deleteEnvironmentVariablePromise = deleteEnvironmentVariable({
      variables: {
        id,
      },
    });

    await toast.promise(
      deleteEnvironmentVariablePromise,
      {
        loading: 'Deleting environment variable...',
        success: 'Environment variable has been deleted successfully.',
        error: 'An error occurred while deleting the environment variable.',
      },
      getToastStyleProps(),
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_ENVIRONMENT_VARIABLE', {
      title: 'Create Environment Variable',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: EnvironmentVariable) {
    openDialog('EDIT_ENVIRONMENT_VARIABLE', {
      title: 'Edit Environment Variables',
      payload: { originalEnvironmentVariable: originalVariable },
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

  const availableEnvironmentVariables =
    [...data.environmentVariables].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ) || [];

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
        <Text className="font-medium lg:col-span-2">Updated</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        {availableEnvironmentVariables.length > 0 && (
          <List>
            {availableEnvironmentVariables.map((environmentVariable, index) => {
              const timestamp = formatDistanceToNowStrict(
                parseISO(environmentVariable.updatedAt),
                { addSuffix: true, roundingMethod: 'floor' },
              );

              return (
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
                          <IconButton variant="borderless" color="secondary">
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
                            onClick={() =>
                              handleOpenEditor(environmentVariable)
                            }
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

                    <Text
                      variant="subtitle1"
                      className="truncate lg:col-span-2"
                    >
                      {timestamp === '0 seconds ago' ||
                      timestamp === 'in 0 seconds'
                        ? 'Now'
                        : timestamp}
                    </Text>
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
              );
            })}
          </List>
        )}

        <Button
          className="mx-4 justify-self-start"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
        >
          Create Environment Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
