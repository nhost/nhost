import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { RoleFormValues } from '@/components/settings/roles/RoleForm';
import SettingsContainer from '@/components/settings/SettingsContainer';
import useLeaveConfirm from '@/hooks/common/useLeaveConfirm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
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
   * Default role.
   */
  authUserDefaultRole: string;
  /**
   * Allowed roles for the project.
   */
  authUserDefaultAllowedRoles: Role[];
}

function getUserRoles(roles?: string) {
  if (!roles) {
    return [] as Role[];
  }

  return roles.split(',').map((role) => ({
    name: role.trim(),
    isSystemRole: role === 'user' || role === 'me',
  })) as Role[];
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
      authUserDefaultRole: data?.app?.authUserDefaultRole || 'user',
      authUserDefaultAllowedRoles: getUserRoles(
        data?.app?.authUserDefaultAllowedRoles,
      ),
    },
  });

  const {
    reset,
    formState: { dirtyFields },
  } = form;

  useLeaveConfirm({ isDirty: Object.keys(dirtyFields).length > 0 });

  useEffect(() => {
    reset({
      authUserDefaultRole: data?.app?.authUserDefaultRole || 'user',
      authUserDefaultAllowedRoles: getUserRoles(
        data?.app?.authUserDefaultAllowedRoles,
      ),
    });
  }, [data, reset]);

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  const { setValue, formState, watch } = form;
  const defaultRole = watch('authUserDefaultRole');
  const availableRoles = watch('authUserDefaultAllowedRoles');

  function handleAddRole({ name }: RoleFormValues) {
    setValue(
      'authUserDefaultAllowedRoles',
      [...availableRoles, { name, isSystemRole: false }],
      { shouldDirty: true },
    );
  }

  function handleEditRole({ name }: RoleFormValues, originalRole: Role) {
    const originalIndex = availableRoles.findIndex(
      (role) => role.name === originalRole.name,
    );
    const updatedRoles = availableRoles.map((role, index) =>
      index === originalIndex ? { name, isSystemRole: false } : role,
    );

    setValue('authUserDefaultAllowedRoles', updatedRoles, {
      shouldDirty: true,
    });
  }

  function handleRemoveRole({ name }: Role) {
    const filteredRoles = availableRoles.filter((role) => role.name !== name);

    setValue('authUserDefaultAllowedRoles', filteredRoles, {
      shouldDirty: true,
    });
  }

  function handleOpenCreator() {
    openDialog('MANAGE_ROLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Add Role</span>

          <Text variant="subtitle1" component="span">
            Enter the name for the role below.
          </Text>
        </span>
      ),
      payload: {
        availableRoles,
        submitButtonText: 'Create',
        onSubmit: handleAddRole,
      },
      props: { PaperProps: { className: 'max-w-sm' } },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog('MANAGE_ROLE', {
      title: (
        <span className="grid grid-flow-row">
          <span>Edit Role</span>

          <Text variant="subtitle1" component="span">
            Enter the name for the role below.
          </Text>
        </span>
      ),
      payload: {
        originalRole,
        availableRoles,
        onSubmit: (values: RoleFormValues) =>
          handleEditRole(values, originalRole),
      },
      props: { PaperProps: { className: 'max-w-sm' } },
    });
  }

  function handleConfirmRemove(originalRole: Role) {
    openAlertDialog({
      title: 'Remove Role',
      payload: (
        <Text>
          Are you sure you want to remove the &quot;
          <strong>{originalRole.name}</strong>&quot; role?
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleRemoveRole(originalRole),
        primaryButtonColor: 'error',
        primaryButtonText: 'Remove',
      },
    });
  }

  function handleSetAsDefault(role: Role) {
    setValue('authUserDefaultRole', role.name, { shouldDirty: true });
  }

  async function handleSubmit(values: RoleSettingsFormValues) {
    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultRole: values.authUserDefaultRole,
          authUserDefaultAllowedRoles: values.authUserDefaultAllowedRoles
            .map(({ name }) => name)
            .join(','),
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
          description="Roles are used to control access to your application."
          docsLink="https://docs.nhost.io/authentication/users#roles"
          rootClassName="gap-0"
          className="px-0 my-2"
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

          <div className="grid grid-flow-row gap-2">
            <List>
              {availableRoles.map((role, index) => (
                <Fragment key={role.name}>
                  <ListItem.Root
                    className="px-4"
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
                            onClick={() => handleSetAsDefault(role)}
                          >
                            <Text className="font-medium">Set as Default</Text>
                          </Dropdown.Item>

                          <Divider component="li" />

                          <Dropdown.Item
                            disabled={role.isSystemRole}
                            onClick={() => handleOpenEditor(role)}
                          >
                            <Text className="font-medium">Edit</Text>
                          </Dropdown.Item>

                          <Divider component="li" />

                          <Dropdown.Item
                            disabled={role.isSystemRole}
                            onClick={() => handleConfirmRemove(role)}
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
                    <ListItem.Text
                      primaryTypographyProps={{
                        className:
                          'inline-grid grid-flow-col gap-1 items-center h-6 font-medium',
                      }}
                      primary={
                        <>
                          {role.name}

                          {role.isSystemRole && (
                            <LockIcon className="w-4 h-4" />
                          )}

                          {defaultRole === role.name && (
                            <Chip
                              component="span"
                              color="info"
                              size="small"
                              label="Default"
                            />
                          )}
                        </>
                      }
                    />
                  </ListItem.Root>

                  <Divider
                    component="li"
                    className={twMerge(
                      index === availableRoles.length - 1 ? '!mt-4' : '!my-4',
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
              Add Role
            </Button>
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
