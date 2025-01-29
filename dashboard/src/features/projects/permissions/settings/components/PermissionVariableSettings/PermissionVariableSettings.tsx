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
import { LockIcon } from '@/components/ui/v2/icons/LockIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { CreatePermissionVariableForm } from '@/features/projects/permissions/settings/components/CreatePermissionVariableForm';
import { EditPermissionVariableForm } from '@/features/projects/permissions/settings/components/EditPermissionVariableForm';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import type { PermissionVariable } from '@/types/application';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

export default function PermissionVariableSettings() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error, refetch } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { customClaims: permissionVariables } =
    data?.config?.auth?.session?.accessToken || {};

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  if (error) {
    throw error;
  }

  function showApplyChangesDialog() {
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
  }

  async function handleDeleteVariable({ id }: PermissionVariable) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          auth: {
            session: {
              accessToken: {
                customClaims: permissionVariables
                  ?.filter((permissionVariable) => permissionVariable.id !== id)
                  .map((permissionVariable) => ({
                    key: permissionVariable.key,
                    value: permissionVariable.value,
                  })),
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        showApplyChangesDialog();
      },
      {
        loadingMessage: 'Deleting permission variable...',
        successMessage: 'Permission variable has been deleted successfully.',
        errorMessage:
          'An error occurred while trying to delete permission variable.',
      },
    );
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create Permission Variable',
      component: <CreatePermissionVariableForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: PermissionVariable) {
    openDialog({
      title: 'Edit Permission Variable',
      component: (
        <EditPermissionVariableForm
          originalVariable={originalVariable}
          onSubmit={refetch}
        />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: PermissionVariable) {
    openAlertDialog({
      title: 'Delete Permission Variable',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>X-Hasura-{originalVariable.key}</strong>&quot; permission
          variable? This cannot be undone.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteVariable(originalVariable),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  const availablePermissionVariables =
    getAllPermissionVariables(permissionVariables);

  return (
    <SettingsContainer
      title="Permission Variables"
      description="Permission variables are used to define permission rules in the GraphQL API."
      docsLink="https://docs.nhost.io/guides/api/permissions#permission-variables"
      rootClassName="gap-0"
      className="my-2 px-0"
      slotProps={{ submitButton: { className: 'hidden' } }}
    >
      <Box className="grid grid-cols-2 border-b-1 px-4 py-3">
        <Text className="font-medium">Field name</Text>
        <Text className="font-medium">Path</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        <List>
          {availablePermissionVariables.map((permissionVariable, index) => (
            <Fragment key={permissionVariable.id}>
              <ListItem.Root
                className="grid grid-cols-2 px-4"
                secondaryAction={
                  <Dropdown.Root>
                    <Tooltip
                      title={
                        permissionVariable.isSystemVariable
                          ? "You can't edit system permission variables"
                          : ''
                      }
                      placement="right"
                      disableHoverListener={
                        !permissionVariable.isSystemVariable
                      }
                      hasDisabledChildren={permissionVariable.isSystemVariable}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <Dropdown.Trigger asChild hideChevron>
                        <IconButton
                          variant="borderless"
                          color="secondary"
                          disabled={
                            permissionVariable.isSystemVariable ||
                            maintenanceActive
                          }
                        >
                          <DotsVerticalIcon />
                        </IconButton>
                      </Dropdown.Trigger>
                    </Tooltip>

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
                        onClick={() => handleOpenEditor(permissionVariable)}
                      >
                        <Text className="font-medium">Edit</Text>
                      </Dropdown.Item>

                      <Divider component="li" />

                      <Dropdown.Item
                        onClick={() => handleConfirmDelete(permissionVariable)}
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
                <ListItem.Text
                  primary={
                    <>
                      X-Hasura-{permissionVariable.key}{' '}
                      {permissionVariable.isSystemVariable && (
                        <LockIcon className="h-4 w-4" />
                      )}
                    </>
                  }
                />

                <Text className="font-medium">
                  user.{permissionVariable.value}
                </Text>
              </ListItem.Root>

              <Divider
                component="li"
                className={twMerge(
                  index === availablePermissionVariables.length - 1
                    ? '!mt-4'
                    : '!my-4',
                )}
              />
            </Fragment>
          ))}
        </List>

        <Button
          className="mx-4 justify-self-start"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
          disabled={maintenanceActive}
        >
          Create Permission Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
