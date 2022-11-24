import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { PermissionVariableFormValues } from '@/components/settings/permissions/PermissionVariableForm';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
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
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetAppCustomClaimsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { Fragment, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  authJwtCustomClaims: CustomClaim[];
}

function getPermissionVariables(customClaims?: Record<string, any>) {
  const systemClaims: CustomClaim[] = [
    { key: 'User-Id', value: 'id', isSystemClaim: true },
  ];

  if (!customClaims) {
    return systemClaims;
  }

  return systemClaims.concat(
    Object.keys(customClaims)
      .sort()
      .map((key) => ({
        key,
        value: customClaims[key],
      })),
  );
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

  const form = useForm<PermissionVariableSettingsFormValues>({
    defaultValues: {
      authJwtCustomClaims: getPermissionVariables(
        data?.app?.authJwtCustomClaims,
      ),
    },
  });

  const { reset } = form;

  useEffect(() => {
    reset({
      authJwtCustomClaims: getPermissionVariables(
        data?.app?.authJwtCustomClaims,
      ),
    });
  }, [data, reset]);

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  if (error) {
    throw error;
  }

  const { setValue, formState, watch } = form;
  const availableCustomClaims = watch('authJwtCustomClaims');

  function handleCreateVariable({ key, value }: PermissionVariableFormValues) {
    setValue(
      'authJwtCustomClaims',
      [...availableCustomClaims, { key, value }],
      { shouldDirty: true },
    );
  }

  function handleEditVariable(
    { key, value }: PermissionVariableFormValues,
    originalVariable: CustomClaim,
  ) {
    const originalIndex = availableCustomClaims.findIndex(
      (customClaim) => customClaim.key === originalVariable.key,
    );
    const updatedVariables = availableCustomClaims.map((customClaim, index) =>
      index === originalIndex ? { key, value } : customClaim,
    );

    setValue('authJwtCustomClaims', updatedVariables, { shouldDirty: true });
  }

  function handleDeleteVariable({ key }: CustomClaim) {
    const filteredCustomClaims = availableCustomClaims.filter(
      (customClaim) => customClaim.key !== key,
    );

    setValue('authJwtCustomClaims', filteredCustomClaims, {
      shouldDirty: true,
    });
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
        availableVariables: availableCustomClaims,
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
        availableVariables: availableCustomClaims,
        originalVariable,
        onSubmit: (values: PermissionVariableFormValues) =>
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
    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authJwtCustomClaims: values.authJwtCustomClaims
            .filter((customClaim) => !customClaim.isSystemClaim)
            .reduce(
              (authJwtCustomClaims, claim) => ({
                ...authJwtCustomClaims,
                [claim.key]: claim.value,
              }),
              {},
            ),
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Updating permission variables...',
        success: 'Permission variables have been updated successfully.',
        error: 'An error occurred while updating permission variables.',
      },
      toastStyleProps,
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Permission Variables"
          description="These variables can be used to defined permissions. They are sent from client to the GraphQL API, and must match the specified property of a queried user."
          className="px-0"
          slotProps={{
            submitButtonProps: {
              loading: formState.isSubmitting,
              disabled: !formState.isValid || !formState.isDirty,
            },
          }}
        >
          <div className="grid grid-cols-2 border-b-1 border-gray-200 px-4 py-3">
            <Text className="font-medium">Field name</Text>
            <Text className="font-medium">Path</Text>
          </div>

          <List>
            {availableCustomClaims.map((customClaim, index) => (
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
                    index === availableCustomClaims.length - 1
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
            Create New Variable
          </Button>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
