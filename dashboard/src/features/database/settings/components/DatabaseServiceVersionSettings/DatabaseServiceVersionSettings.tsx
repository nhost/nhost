import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetPostgresSettingsDocument,
  Software_Type_Enum,
  useGetPostgresSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { DatabaseMigrateVersionConfirmationDialog } from '@/features/database/settings/components/DatabaseMigrateVersionConfirmationDialog';
import { DatabaseMigrateLogsModal } from '@/features/database/settings/components/DatabaseMigrateLogsModal';

const validationSchema = Yup.object({
  majorVersion: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  })
    .label('Postgres Major Version')
    .required(),
  minorVersion: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  }),
});

export type DatabaseServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DatabaseServiceVersionSettings() {
  const isPlatform = useIsPlatform();
  const { openDialog, closeDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetPostgresSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  // const [updatePostgresMajor] = useUpdateDatabaseVersionMutation({
  //   refetchQueries: [GetPostgresSettingsDocument],
  //   ...(!isPlatform ? { client: localMimirClient } : {}),
  // });

  const {
    data,
    loading,
    error,
    refetch: refetchVersions,
  } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data: databaseVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.PostgreSql,
    },
    skip: !isPlatform,
  });

  const { version } = data?.config?.postgres || {};
  const [majorVersion, minorVersion] = version?.split('.') || [
    undefined,
    undefined,
  ];

  const databaseVersions = databaseVersionsData?.softwareVersions || [];
  const availableVersions = Array.from(
    new Set(databaseVersions.map((el) => el.version)).add(version),
  )
    .sort()
    .reverse()
    .map((availableVersion) => ({
      label: availableVersion,
      value: availableVersion,
    }));

  const form = useForm<DatabaseServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      minorVersion: { label: '', value: '' },
      majorVersion: { label: '', value: '' },
    },
    resolver: yupResolver(validationSchema),
  });

  const availableMajorVersions = [];
  const availableMinorVersions = [];

  const currentPostgresMajor = data?.config?.postgres?.version.split('.')[0];

  availableVersions.forEach((availableVersion) => {
    if (!availableVersion.value) {
      return;
    }
    const [major, minor] = availableVersion.value.split('.');

    // Don't show versions that are lower than the current Postgres major version (can't downgrade)
    if (Number(major) < Number(currentPostgresMajor)) {
      return;
    }

    availableMajorVersions.push({
      label: major,
      value: major,
    });

    if (major === form.getValues('majorVersion').value) {
      availableMinorVersions.push({ label: minor, value: minor });
    }
  });

  useEffect(() => {
    if (!loading && majorVersion && minorVersion) {
      form.reset({
        majorVersion: { label: majorVersion, value: majorVersion },
        minorVersion: { label: minorVersion, value: minorVersion },
      });
    }
  }, [loading, majorVersion, minorVersion, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Postgres version..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const isMajorVersionDirty = formState?.dirtyFields?.majorVersion;

  const handleDatabaseServiceVersionsChange = async (
    formValues: DatabaseServiceVersionFormValues,
  ) => {
    const newVersion = `${formValues.majorVersion.value}.${formValues.minorVersion.value}`;

    if (isMajorVersionDirty) {
      openDialog({
        title: 'Update Postgres MAJOR version',
        component: (
          <DatabaseMigrateVersionConfirmationDialog
            postgresVersion={newVersion}
            onCancel={() => undefined}
            onProceed={() => refetchVersions()}
          />
        ),
        props: {
          PaperProps: {
            className: 'max-w-2xl',
          },
        },
      });

      return;
    }
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          postgres: {
            version: newVersion,
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

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
        loadingMessage: 'Postgres version is being updated...',
        successMessage: 'Postgres version has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Postgres version.',
      },
    );
  };

  console.log('isMajorVersionDirty', isMajorVersionDirty);


  const openLatestUpgradeLogsModal = async (
  ) => {
    openDialog({
      component: (
        <DatabaseMigrateLogsModal />
      ),
      props: {
        PaperProps: { className: 'p-0 max-w-2xl w-full' },
        titleProps: {
          onClose: closeDialog,
        },
      },
      title: 'Postgres upgrade logs',
    });
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDatabaseServiceVersionsChange}>
        <SettingsContainer
          title="Postgres Version"
          description="The version of Postgres to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://hub.docker.com/r/nhost/postgres/tags"
          docsTitle="the latest releases"
          className="flex flex-col"
          topRightElement={
            <Button
              variant="outlined"
              color="primary"
              size="medium"
              className="self-center"
              onClick={
          openLatestUpgradeLogsModal
              }
            >
              View latest upgrade logs
            </Button>
          }
        >
          <Box className="grid grid-flow-row gap-x-4 gap-y-2 lg:grid-cols-5">
            <ControlledAutocomplete
              id="majorVersion"
              name="majorVersion"
              autoHighlight
              freeSolo
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option || '';
                }

                return option.value;
              }}
              isOptionEqualToValue={() => false}
              filterOptions={(options, { inputValue }) => {
                const inputValueLower = inputValue.toLowerCase();
                const matched = [];
                const otherOptions = [];

                options.forEach((option) => {
                  const optionLabelLower = option.label.toLowerCase();

                  if (optionLabelLower.startsWith(inputValueLower)) {
                    matched.push(option);
                  } else {
                    otherOptions.push(option);
                  }
                });

                const result = [...matched, ...otherOptions];

                return result;
              }}
              onChange={(_event, value) => {
                // Reset minor version when major version changes
                form.setValue('minorVersion', { label: '', value: '' });

                if (typeof value !== 'string' && !Array.isArray(value)) {
                  form.setValue('majorVersion', value);
                }
              }}
              fullWidth
              className="lg:col-span-1"
              label="MAJOR"
              options={availableMajorVersions}
              error={!!formState.errors?.majorVersion?.message}
              helperText={formState.errors?.majorVersion?.message}
              showCustomOption="auto"
              customOptionLabel={(value) => `Use custom value: "${value}"`}
            />
            <ControlledAutocomplete
              id="minorVersion"
              name="minorVersion"
              autoHighlight
              freeSolo
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option || '';
                }

                return option.value;
              }}
              isOptionEqualToValue={() => false}
              filterOptions={(options, { inputValue }) => {
                const inputValueLower = inputValue.toLowerCase();
                const matched = [];
                const otherOptions = [];

                options.forEach((option) => {
                  const optionLabelLower = option.label.toLowerCase();

                  if (optionLabelLower.startsWith(inputValueLower)) {
                    matched.push(option);
                  } else {
                    otherOptions.push(option);
                  }
                });

                const result = [...matched, ...otherOptions];

                return result;
              }}
              fullWidth
              className="lg:col-span-2"
              label="MINOR"
              options={availableMinorVersions}
              error={!!formState.errors?.minorVersion?.message}
              helperText={formState.errors?.minorVersion?.message}
              showCustomOption="auto"
              customOptionLabel={(value) => `Use custom value: "${value}"`}
            />
          </Box>
          {isMajorVersionDirty && (
            <Alert severity="warning" className="flex flex-col gap-2 text-left">
              <Text className="font-semibold">
                ⚠ Warning: upgrading Postgres major version
              </Text>
              <div className="flex flex-col gap-4">
                <Text>
                  Upgrading a major version of Postgres requires downtime. The
                  amount of downtime will depend on your database size, so plan
                  ahead in order to reduce the impact on your users.
                </Text>
                <Text>
                  Note that it isn&apos;t possible to downgrade between major
                  versions.
                </Text>
              </div>
            </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
