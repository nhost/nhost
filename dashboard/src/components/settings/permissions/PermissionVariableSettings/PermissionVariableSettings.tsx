import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { CustomClaim } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import getPermissionVariablesArray from '@/utils/settings/getPermissionVariablesArray';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetAppCustomClaimsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  authJwtCustomClaims: CustomClaim[];
}

export default function PermissionVariableSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error } = useGetAppCustomClaimsQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: ['getAppCustomClaims'],
  });

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  if (error) {
    throw error;
  }

  async function handleDeleteVariable({ key }: CustomClaim) {
    const filteredCustomClaims = Object.keys(
      data?.app?.authJwtCustomClaims,
    ).filter((customClaimKey) => customClaimKey !== key);

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authJwtCustomClaims: filteredCustomClaims.reduce(
            (customClaims, currentKey) => ({
              ...customClaims,
              [currentKey]: data?.app?.authJwtCustomClaims[currentKey],
            }),
            {},
          ),
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Deleting permission variable...',
        success: 'Permission variable has been deleted successfully.',
        error: 'An error occurred while trying to delete permission variable.',
      },
      getToastStyleProps(),
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_PERMISSION_VARIABLE', {
      title: 'Create Permission Variable',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: CustomClaim) {
    openDialog('EDIT_PERMISSION_VARIABLE', {
      title: 'Edit Permission Variable',
      payload: { originalVariable },
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: CustomClaim) {
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

  const availablePermissionVariables = getPermissionVariablesArray(
    data?.app?.authJwtCustomClaims,
  );

  return (
    <SettingsContainer
      title="Permission Variables"
      description="Permission variables are used to define permission rules in the GraphQL API."
      docsLink="https://docs.nhost.io/graphql/permissions"
      rootClassName="gap-0"
      className="px-0 my-2"
      slotProps={{ submitButton: { className: 'invisible' } }}
    >
      <Box className="grid grid-cols-2 border-b-1 px-4 py-3">
        <Text className="font-medium">Field name</Text>
        <Text className="font-medium">Path</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        <List>
          {availablePermissionVariables.map((customClaim, index) => (
            <Fragment key={customClaim.key}>
              <ListItem.Root
                className="px-4 grid grid-cols-2"
                secondaryAction={
                  <Dropdown.Root>
                    <Tooltip
                      title={
                        customClaim.isSystemClaim
                          ? "You can't edit system permission variables"
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
                        onClick={() => handleOpenEditor(customClaim)}
                      >
                        <Text className="font-medium">Edit</Text>
                      </Dropdown.Item>

                      <Divider component="li" />

                      <Dropdown.Item
                        onClick={() => handleConfirmDelete(customClaim)}
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
                      X-Hasura-{customClaim.key}{' '}
                      {customClaim.isSystemClaim && (
                        <LockIcon className="w-4 h-4" />
                      )}
                    </>
                  }
                />

                <Text className="font-medium">user.{customClaim.value}</Text>
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
          className="justify-self-start mx-4"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
        >
          Create Permission Variable
        </Button>
      </div>
    </SettingsContainer>
  );
}
