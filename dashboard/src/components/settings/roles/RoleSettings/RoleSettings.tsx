import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { BaseRoleFormValues } from '@/components/settings/roles/BaseRoleForm';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
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
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { Fragment, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface RoleSettingsFormValues {
  /**
   * Allowed roles for the project.
   */
  authUserDefaultAllowedRoles: string;
}

function getUserRoles(roles?: string) {
  if (!roles) {
    return [];
  }

  return roles.split(',').map((role, index) => ({
    id: `${index}-${role}`,
    name: role.trim(),
    isSystemRole: role === 'user' || role === 'me',
  }));
}

export default function RoleSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: ['getRoles'],
  });

  const form = useForm<RoleSettingsFormValues>({
    defaultValues: {
      authUserDefaultAllowedRoles: data?.app?.authUserDefaultAllowedRoles || '',
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (data?.app?.authUserDefaultAllowedRoles) {
      reset({
        authUserDefaultAllowedRoles: data.app.authUserDefaultAllowedRoles,
      });
    }
  }, [data, reset]);

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  const { setValue, formState, watch } = form;
  const availableRoles = watch('authUserDefaultAllowedRoles');
  const userRoles = getUserRoles(availableRoles);

  function handleCreateRole(values: BaseRoleFormValues) {
    setValue(
      'authUserDefaultAllowedRoles',
      `${availableRoles},${values.roleName}`,
      { shouldDirty: true },
    );
  }

  function handleEditRole(
    values: BaseRoleFormValues,
    originalRoleName: string,
  ) {
    const availableRoleList = availableRoles.split(',') || [];
    const originalIndex = availableRoleList.findIndex(
      (role) => role === originalRoleName,
    );
    const updatedRoles = availableRoleList
      .map((role, index) => (index === originalIndex ? values.roleName : role))
      .join(',');

    setValue('authUserDefaultAllowedRoles', updatedRoles, {
      shouldDirty: true,
    });
  }

  function handleDeleteRole(originalRoleName: string) {
    const existingRoleListWithoutOriginalRole = availableRoles
      .split(',')
      .filter((role) => role !== originalRoleName)
      .join(',');

    setValue(
      'authUserDefaultAllowedRoles',
      existingRoleListWithoutOriginalRole,
      { shouldDirty: true },
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_ROLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Create a New Role</span>

          <Text variant="subtitle1" component="span">
            Enter the name for the role below.
          </Text>
        </span>
      ),
      payload: {
        availableRoles,
        onSubmit: handleCreateRole,
      },
      props: {
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRoleName: string) {
    openDialog('EDIT_ROLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Edit Role</span>

          <Text variant="subtitle1" component="span">
            Enter the name for the role below.
          </Text>
        </span>
      ),
      props: { PaperProps: { className: 'max-w-sm' } },
      payload: {
        originalRole: originalRoleName,
        availableRoles,
        onSubmit: (values: BaseRoleFormValues) =>
          handleEditRole(values, originalRoleName),
      },
    });
  }

  function handleConfirmDelete(originalRoleName: string) {
    openAlertDialog({
      title: 'Delete role',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{originalRoleName}</strong>&quot; role? This action cannot be
          undone once you save the roles.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteRole(originalRoleName),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  async function handleSubmit(values: RoleSettingsFormValues) {
    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultAllowedRoles: values.authUserDefaultAllowedRoles,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Updating roles...',
        success: 'Roles have been updated successfully.',
        error: 'An error occurred while updating roles.',
      },
      toastStyleProps,
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Roles"
          description="Add and change permissions for different roles."
          className="px-0"
          slotProps={{
            submitButtonProps: {
              loading: formState.isSubmitting,
              disabled: !formState.isValid || !formState.isDirty,
            },
          }}
        >
          <div className="border-b-1 border-gray-200 px-4 py-3">
            <Text className="font-medium">Name</Text>
          </div>

          <List>
            {userRoles.map((role, index) => (
              <Fragment key={role.id}>
                <ListItem.Root
                  secondaryAction={
                    <Dropdown.Root>
                      <Tooltip
                        title={
                          role.isSystemRole ? "You can't edit system roles" : ''
                        }
                        placement="right"
                        disableHoverListener={!role.isSystemRole}
                        hasDisabledChildren={role.isSystemRole}
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        <Dropdown.Trigger asChild hideChevron>
                          <IconButton
                            variant="borderless"
                            color="secondary"
                            disabled={role.isSystemRole}
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
                          onClick={() => handleOpenEditor(role.name)}
                        >
                          <Text className="font-medium">Edit Role</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          onClick={() => handleConfirmDelete(role.name)}
                        >
                          <Text
                            className="font-medium"
                            sx={{ color: (theme) => theme.palette.error.main }}
                          >
                            Delete Role
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                  className="px-4"
                >
                  <ListItem.Text
                    primary={role.name}
                    secondary={
                      role.isSystemRole ? 'System Role' : 'Custom Role'
                    }
                  />
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === userRoles.length - 1 ? '!mt-4' : '!my-4',
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
            Create New Role
          </Button>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
