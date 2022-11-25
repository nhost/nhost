import SettingsContainer from '@/components/settings/SettingsContainer';
import Button from '@/components/ui/v2/Button';
import Divider from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import IconButton from '@/components/ui/v2/IconButton';
import DotsVerticalIcon from '@/components/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/components/ui/v2/icons/PlusIcon';
import useLeaveConfirm from '@/hooks/common/useLeaveConfirm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import type { GetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import { useGetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import { format } from 'date-fns';
import { Fragment, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

type EnvironmentVariable =
  GetEnvironmentVariablesQuery['environmentVariables'][number];

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  environmentVariables: EnvironmentVariable[];
}

export default function ProjectEnvironmentVariableSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<PermissionVariableSettingsFormValues>({
    defaultValues: {
      environmentVariables: data?.environmentVariables || [],
    },
    reValidateMode: 'onSubmit',
  });

  const {
    reset,
    formState: { dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;
  useLeaveConfirm({ isDirty });

  useEffect(() => {
    reset({
      environmentVariables: data?.environmentVariables || [],
    });
  }, [data, reset]);

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

  function handleOpenCreator() {
    console.log(`open creator`);
  }

  function handleOpenEditor(variable: EnvironmentVariable) {}
  function handleConfirmRemove(variable: EnvironmentVariable) {}

  const { formState, watch } = form;
  const availableEnvironmentVariables = watch('environmentVariables');

  return (
    <SettingsContainer
      title="Project Environment Variables"
      description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
      docsLink="https://docs.nhost.io/platform/environment-variables"
      docsTitle="Environment Variables"
      rootClassName="gap-0"
      className="px-0 my-2"
      slotProps={{
        submitButton: {
          loading: formState.isSubmitting,
          disabled: !formState.isValid || !isDirty,
        },
      }}
    >
      <div className="grid grid-cols-2 border-b-1 border-gray-200 px-4 py-3">
        <Text className="font-medium">Variable Name</Text>
        <Text className="font-medium">Updated</Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <List>
          {availableEnvironmentVariables.map((environmentVariable, index) => (
            <Fragment key={environmentVariable.name}>
              <ListItem.Root
                className="px-4 grid grid-cols-2"
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
                        onClick={() => handleOpenEditor(environmentVariable)}
                      >
                        <Text className="font-medium">Edit</Text>
                      </Dropdown.Item>

                      <Divider component="li" />

                      <Dropdown.Item
                        onClick={() => handleConfirmRemove(environmentVariable)}
                      >
                        <Text
                          className="font-medium"
                          sx={{
                            color: (theme) => theme.palette.error.main,
                          }}
                        >
                          Remove
                        </Text>
                      </Dropdown.Item>
                    </Dropdown.Content>
                  </Dropdown.Root>
                }
              >
                <ListItem.Text>{environmentVariable.name}</ListItem.Text>

                <Text className="font-medium">
                  {format(
                    new Date(environmentVariable.updatedAt),
                    'dd MMM yyyy',
                  )}
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
          ))}
        </List>

        <Button
          className="justify-self-start mx-4"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
        >
          Add Environment Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
