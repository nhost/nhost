import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';

import { CreateRoleForm } from '@/features/orgs/projects/roles/settings/components/CreateRoleForm';
import { EditRoleForm } from '@/features/orgs/projects/roles/settings/components/EditRoleForm';

import type { Role } from '@/types/application';
import {
  GetRolesPermissionsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { Form, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  emails: Yup.array().of(
    Yup.string().email('Invalid email address').required(),
  ),
});

type ContactPointsEmailFormValues = Yup.InferType<typeof validationSchema>;

export default function ContactPointsEmailSettings() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error, refetch } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { emails } = data?.config?.observability?.grafana?.contacts || {};

  const { fields, append, remove } = useFieldArray({
    name: 'emails',
  });

  const { host, port, user, sender, password } =
    data?.config?.observability?.grafana?.smtp || {};

  const form = useForm<ContactPointsEmailFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
    defaultValues: {
      emails: [],
    },
    values: {
      emails: emails || [],
    },
    mode: 'onSubmit',
    // criteriaMode: 'all',
  });

  const {
    register,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  async function showApplyChangesDialog() {
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

  const handleEditContactPointsEmailSettings = async (
    values: ContactPointsEmailFormValues,
  ) => {
    const { emails } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          observability: {
            grafana: {
              contacts: {
                emails: values.emails,
              },
            },
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
        loadingMessage: 'SMTP settings are being updated...',
        successMessage: 'SMTP settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the SMTP settings.',
      },
    );
  };

  async function handleSetAsDefault({ name }: Role) {
    // const updateConfigPromise = updateConfig({
    //   variables: {
    //     appId: project?.id,
    //     config: {
    //       grafana: {
    //         contacts: {
    //           emails: {
    //           },
    //         },
    //       },
    //     },
    //   },
    // });
    // await execPromiseWithErrorToast(
    //   async () => {
    //     await updateConfigPromise;
    //     showApplyChangesDialog();
    //   },
    //   {
    //     loadingMessage: 'Updating default role...',
    //     successMessage: 'Default role has been updated successfully.',
    //     errorMessage:
    //       'An error occurred while trying to update the default role.',
    //   },
    // );
  }

  async function handleDeleteRole({ name }: Role) {}

  function handleOpenCreator() {
    openDialog({
      title: 'Create Allowed Role',
      component: <CreateRoleForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog({
      title: 'Edit Allowed Role',
      component: (
        <EditRoleForm originalRole={originalRole} onSubmit={refetch} />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalRole: Role) {
    openAlertDialog({
      title: 'Delete Allowed Role',
      payload: (
        <Text>
          Are you sure you want to delete the allowed role &quot;
          <strong>{originalRole.name}</strong>&quot;?.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteRole(originalRole),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditSMTPSettings}>
        <SettingsContainer
          title="Contact Points"
          description="Select your preferred emails for receiving notifications when your alert rules are firing."
          docsLink="https://docs.nhost.io/platform/metrics#configure-contact-points"
          rootClassName="gap-0"
          submitButtonText="Save"
          className={twMerge('my-2 px-0')}
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: isSubmitting,
            },
          }}
        >
          <Box className="border-b-1 px-4 py-3">
            <Text className="font-medium">Name</Text>
          </Box>

          <div className="grid grid-flow-row gap-2">
            {/* {availableAllowedRoles.length > 0 && (
          <List>
            {availableAllowedRoles.map((role, index) => (
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
                        <Dropdown.Item onClick={() => handleSetAsDefault(role)}>
                          <Text className="font-medium">Set as Default</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item onClick={() => handleOpenEditor(role)}>
                          <Text className="font-medium">Edit</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          onClick={() => handleConfirmDelete(role)}
                        >
                          <Text className="font-medium" color="error">
                            Delete
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
                      </>
                    }
                  />
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                      '!my-4'
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
          Create Allowed Role
        </Button> */}
            <Button
              className="mx-4 justify-self-start"
              variant="borderless"
              startIcon={<PlusIcon />}
              onClick={handleOpenCreator}
              disabled={maintenanceActive}
            >
              Add a new email
            </Button>
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
