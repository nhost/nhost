import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import useCustomClaims from '@/hooks/useCustomClaims';
import type { CustomClaim } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import { Fragment } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  authJwtCustomClaims: string;
}

export default function PermissionVariableSettings() {
  const { data: customClaims, loading } = useCustomClaims();
  const { openDialog, openAlertDialog } = useDialog();

  const form = useForm();

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  const { formState } = form;

  function handleCreateVariable(values: PermissionVariableSettingsFormValues) {
    console.log(values);
  }

  function handleEditVariable(
    values: PermissionVariableSettingsFormValues,
    originalVariable: CustomClaim,
  ) {
    console.log(values, originalVariable);
  }

  function handleDeleteVariable(variable: CustomClaim) {
    console.log(variable);
  }

  function handleOpenCreator() {
    openDialog('MANAGE_PERMISSION_VARIABLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Create Permission Variable</span>

          <Text variant="subtitle1" component="span">
            Enter the field name and the path you want to use in this permission
            variable.
          </Text>
        </span>
      ),
      payload: {
        availableVariables: customClaims,
        submitButtonText: 'Create',
        onSubmit: handleCreateVariable,
      },
      props: { PaperProps: { className: 'max-w-sm' } },
    });
  }

  function handleOpenEditor(originalVariable: CustomClaim) {
    openDialog('MANAGE_PERMISSION_VARIABLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Edit Permission Variable</span>

          <Text variant="subtitle1" component="span">
            Enter the field name and the path you want to use in this permission
            variable.
          </Text>
        </span>
      ),
      payload: {
        availableVariables: customClaims,
        originalVariable,
        onSubmit: (values: PermissionVariableSettingsFormValues) =>
          handleEditVariable(values, originalVariable),
      },
      props: { PaperProps: { className: 'max-w-sm' } },
    });
  }

  function handleConfirmDelete(originalVariable: CustomClaim) {
    openAlertDialog({
      title: 'Delete Permission Variable',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>X-Hasura-{originalVariable.key}</strong>&quot; permission
          variable? This action cannot be undone once you save the permission
          variables.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteVariable(originalVariable),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  async function handleSubmit(values: PermissionVariableSettingsFormValues) {
    console.log(values);
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Permission Variables"
          description="These variables can be used to defined PermissionVariable. They are sent from client to the GraphQL API, and must match the specified property of a queried user."
          slotProps={{
            submitButtonProps: {
              loading: formState.isSubmitting,
              disabled: !formState.isValid || !formState.isDirty,
            },
          }}
          className="px-0"
        >
          <div className="grid grid-cols-2 border-b-1 border-gray-200 px-4 py-3">
            <Text className="font-medium">Field name</Text>
            <Text className="font-medium">Path</Text>
          </div>

          <List>
            {customClaims.map((customClaim, index) => (
              <Fragment key={customClaim.key}>
                <ListItem.Root
                  className="px-4 grid grid-cols-2"
                  secondaryAction={
                    <Dropdown.Root>
                      <Tooltip
                        title={
                          customClaim.isSystemClaim
                            ? "You can't edit system variables"
                            : ''
                        }
                        placement="right"
                        disableHoverListener={!customClaim.isSystemClaim}
                        hasDisabledChildren={customClaim.isSystemClaim}
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        <Dropdown.Trigger asChild hideChevron>
                          <IconButton
                            variant="borderless"
                            color="secondary"
                            disabled={customClaim.isSystemClaim}
                          >
                            <DotsVerticalIcon />
                          </IconButton>
                        </Dropdown.Trigger>
                      </Tooltip>

                      <Dropdown.Content
                        menu
                        PaperProps={{ className: 'w-[160px]' }}
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
                          onClick={() => handleOpenEditor(customClaim)}
                        >
                          <Text className="font-medium">Edit Variable</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          onClick={() => handleConfirmDelete(customClaim)}
                        >
                          <Text
                            className="font-medium"
                            sx={{ color: (theme) => theme.palette.error.main }}
                          >
                            Delete Variable
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Text
                    primary={`X-Hasura-${customClaim.key}`}
                    secondary={
                      customClaim.isSystemClaim
                        ? 'System Variable'
                        : 'Custom Variable'
                    }
                  />

                  <Text className="font-medium">user.{customClaim.value}</Text>
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === customClaims.length - 1 ? '!mt-4' : '!my-4',
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
            Create New Variable
          </Button>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
