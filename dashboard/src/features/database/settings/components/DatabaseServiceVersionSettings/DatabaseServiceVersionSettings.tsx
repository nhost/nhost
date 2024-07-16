import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { DatabaseMigrateLogsModal } from '@/features/database/settings/components/DatabaseMigrateLogsModal';
import { DatabaseMigrateVersionConfirmationDialog } from '@/features/database/settings/components/DatabaseMigrateVersionConfirmationDialog';
import { DatabaseMigrateWarning } from '@/features/database/settings/components/DatabaseMigrateWarning';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetPostgresSettingsDocument,
  Software_Type_Enum,
  useGetApplicationStateQuery,
  useGetPostgresSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
  type GetApplicationStateQuery,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { ApplicationStatus } from '@/types/application';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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

  const { formState, watch } = form;

  const selectedMajor = watch('majorVersion').value;

  console.log('selected major:', selectedMajor);

  const currentPostgresMajor = data?.config?.postgres?.version.split('.')[0];

  const getMajorAndMinorVersions = () => {
    const majorToMinorMap = {};
    const majorVersions = [];
    availableVersions.forEach((availableVersion) => {
      if (!availableVersion.value) {
        return;
      }
      const [major, minor] = availableVersion.value.split('.');

      // Don't suggest versions that are lower than the current Postgres major version (can't downgrade)
      if (Number(major) < Number(currentPostgresMajor)) {
        return;
      }

      majorVersions.push({
        label: major,
        value: major,
      });

      if (!majorToMinorMap[major]) {
        majorToMinorMap[major] = [];
      }

      majorToMinorMap[major].push({
        label: minor,
        value: minor,
      });
    });
    return [majorVersions, majorToMinorMap];
  };
  const [availableMajorVersions, majorToMinorVersions] = useMemo(
    getMajorAndMinorVersions,
    [availableVersions, currentPostgresMajor],
  );
  const availableMinorVersions = majorToMinorVersions[selectedMajor] || [];

  useEffect(() => {
    if (!loading && majorVersion && minorVersion) {
      form.reset({
        majorVersion: { label: majorVersion, value: majorVersion },
        minorVersion: { label: minorVersion, value: minorVersion },
      });
    }
  }, [loading, majorVersion, minorVersion, form]);

  const { data: appStatesData, loading: loadingStates } =
    useGetApplicationStateQuery({
      variables: { appId: currentProject?.id },
      skip: !currentProject,
      pollInterval: 5000,
    });

  const shouldShowUpgradeLogs = (
    appStates: GetApplicationStateQuery['app']['appStates'],
  ) => {
    for (let i = 0; i < appStates.length; i += 1) {
      if (appStates[i].stateId === ApplicationStatus.Live) {
        return false;
      }
      if (appStates[i].stateId === ApplicationStatus.Migrating) {
        return true;
      }
    }

    return false;
  };

  const showUpgradeLogs = shouldShowUpgradeLogs(
    appStatesData?.app?.appStates || [],
  );

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

  const isMajorVersionDirty = formState?.dirtyFields?.majorVersion;

  const majorVersionGreaterThanCurrent =
    Number(form.getValues('majorVersion').value) > Number(currentPostgresMajor);

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

    // Minor version change
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

  const openLatestUpgradeLogsModal = async () => {
    openDialog({
      component: <DatabaseMigrateLogsModal />,
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
            showUpgradeLogs ? (
              <Button
                variant="outlined"
                color="primary"
                size="medium"
                className="self-center"
                onClick={openLatestUpgradeLogsModal}
              >
                View latest upgrade logs
              </Button>
            ) : null
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
                // if (!isMajorVersionDirty) {
                //   return options;
                // }
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
          {majorVersionGreaterThanCurrent && <DatabaseMigrateWarning />}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
