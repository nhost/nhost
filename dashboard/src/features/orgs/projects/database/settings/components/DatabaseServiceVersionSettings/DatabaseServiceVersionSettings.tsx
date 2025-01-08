import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { RepeatIcon } from '@/components/ui/v2/icons/RepeatIcon';

import { useGetPostgresVersion } from '@/features/orgs/projects/database/common/hooks/useGetPostgresVersion';
import { useIsDatabaseMigrating } from '@/features/orgs/projects/database/common/hooks/useIsDatabaseMigrating';
import { DatabaseMigrateDisabledError } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateDisabledError';
import { DatabaseMigrateDowntimeWarning } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateDowntimeWarning';
import { DatabaseMigrateLogsModal } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateLogsModal';
import { DatabaseMigrateVersionConfirmationDialog } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateVersionConfirmationDialog';
import { DatabaseUpdateInProgressWarning } from '@/features/orgs/projects/database/settings/components/DatabaseUpdateInProgressWarning';

import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

import {
  GetPostgresSettingsDocument,
  GetWorkspaceAndProjectDocument,
  Software_Type_Enum,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { ApplicationStatus } from '@/types/application';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  majorVersion: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required('Major version is a required field'),
  })
    .label('Postgres major version')
    .required()
    .test('not-zero', 'Invalid major version', (value) => value?.value !== '0'),
  minorVersion: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required('Minor version is a required field'),
  })
    .label('Postgres minor version')
    .required(),
});

export type DatabaseServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

type DatabaseServiceField = Required<
  Yup.InferType<typeof validationSchema>['majorVersion']
>;

export default function DatabaseServiceVersionSettings() {
  const isPlatform = useIsPlatform();
  const { openDialog, closeDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [
      GetPostgresSettingsDocument,
      GetWorkspaceAndProjectDocument,
    ],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    version: postgresVersion,
    postgresMajor: currentPostgresMajor,
    postgresMinor: currentPostgresMinor,
    error: postgresSettingsError,
    loading: loadingPostgresSettings,
  } = useGetPostgresVersion();

  const { data: databaseVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.PostgreSql,
    },
    skip: !isPlatform,
  });

  const databaseVersions = databaseVersionsData?.softwareVersions || [];
  const availableVersions = Array.from(
    new Set(databaseVersions.map((el) => el.version)).add(postgresVersion),
  )
    .sort()
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
  const selectedMinor = watch('minorVersion').value;

  const getMajorAndMinorVersions = (): {
    availableMajorVersions: DatabaseServiceField[];
    majorToMinorVersions: Record<string, DatabaseServiceField[]>;
  } => {
    const majorToMinorVersions = {};
    const availableMajorVersions = [];
    availableVersions.forEach((availableVersion) => {
      if (!availableVersion.value) {
        return;
      }
      const [major, minor] = availableVersion.value.split('.');

      // Don't suggest versions that are lower than the current Postgres major version (can't downgrade)
      if (Number(major) < Number(currentPostgresMajor)) {
        return;
      }

      if (availableMajorVersions.every((item) => item.value !== major)) {
        availableMajorVersions.push({
          label: major,
          value: major,
        });
      }

      if (!majorToMinorVersions[major]) {
        majorToMinorVersions[major] = [];
      }

      majorToMinorVersions[major].push({
        label: minor,
        value: minor,
      });
    });
    return {
      availableMajorVersions,
      majorToMinorVersions,
    };
  };

  const { availableMajorVersions, majorToMinorVersions } = useMemo(
    getMajorAndMinorVersions,
    [availableVersions, currentPostgresMajor],
  );
  const availableMinorVersions = majorToMinorVersions[selectedMajor] || [];

  useEffect(() => {
    if (
      !loadingPostgresSettings &&
      currentPostgresMajor &&
      currentPostgresMinor
    ) {
      form.reset({
        majorVersion: {
          label: currentPostgresMajor,
          value: currentPostgresMajor,
        },
        minorVersion: {
          label: currentPostgresMinor,
          value: currentPostgresMinor,
        },
      });
    }
  }, [
    loadingPostgresSettings,
    currentPostgresMajor,
    currentPostgresMinor,
    form,
  ]);

  const { isMigrating, shouldShowUpgradeLogs } = useIsDatabaseMigrating({
    shouldPoll: true,
  });

  const { state } = useAppState();
  const applicationUpdating =
    state === ApplicationStatus.Updating ||
    state === ApplicationStatus.Migrating;

  const applicationLive = state === ApplicationStatus.Live;
  const applicationPaused = state === ApplicationStatus.Paused;
  const applicationPausing = state === ApplicationStatus.Pausing;

  const showMigrateWarning =
    !applicationPaused &&
    !applicationPausing &&
    Number(selectedMajor) > Number(currentPostgresMajor);

  const applicationUnhealthy =
    !applicationLive &&
    !applicationPaused &&
    !applicationPausing &&
    !applicationUpdating;
  const isMajorVersionDirty = formState?.dirtyFields?.majorVersion;
  const isMinorVersionDirty = formState?.dirtyFields?.minorVersion;
  const isDirty = isMajorVersionDirty || isMinorVersionDirty;

  const versionFieldsDisabled =
    applicationUpdating || applicationUnhealthy || maintenanceActive;
  const saveDisabled = versionFieldsDisabled || !isDirty;

  const handleDatabaseServiceVersionsChange = async (
    formValues: DatabaseServiceVersionFormValues,
  ) => {
    const newVersion = `${formValues.majorVersion.value}.${formValues.minorVersion.value}`;

    // Major version change
    if (isMajorVersionDirty && applicationLive) {
      openDialog({
        title: 'Update Postgres MAJOR version',
        component: (
          <DatabaseMigrateVersionConfirmationDialog
            postgresVersion={newVersion}
            onCancel={() => {}}
            onProceed={() => {}}
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

    // Only minor version change or project is paused/pausing
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
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

  if (loadingPostgresSettings) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Postgres version..."
        className="justify-center"
      />
    );
  }

  if (postgresSettingsError) {
    throw postgresSettingsError;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDatabaseServiceVersionsChange}>
        <SettingsContainer
          title="Postgres Version"
          description="The version of Postgres to use."
          slotProps={{
            submitButton: {
              disabled: saveDisabled,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://hub.docker.com/r/nhost/postgres/tags"
          docsTitle="the latest releases"
          className="flex flex-col"
          topRightElement={
            shouldShowUpgradeLogs ? (
              <Button
                variant="outlined"
                color="primary"
                size="medium"
                className="self-center"
                onClick={openLatestUpgradeLogsModal}
                startIcon={<RepeatIcon className="h-4 w-4" />}
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
              disabled={versionFieldsDisabled}
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option || '';
                }

                return option.value;
              }}
              showCustomOption="auto"
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
                if (typeof value !== 'string' && !Array.isArray(value)) {
                  if (value.value !== selectedMajor) {
                    const nextAvailableMinorVersions =
                      majorToMinorVersions[value.value] || [];

                    const isSelectedMinorAvailable =
                      nextAvailableMinorVersions.some(
                        (minor) => minor.value === selectedMinor,
                      );

                    // If the selected minor version is not available in the new major version, select the first available minor version
                    if (
                      !isSelectedMinorAvailable &&
                      nextAvailableMinorVersions.length > 0
                    ) {
                      form.setValue(
                        'minorVersion',
                        nextAvailableMinorVersions[0],
                      );
                    }
                  }
                  form.setValue('majorVersion', value);
                }
              }}
              clearOnBlur
              fullWidth
              className="lg:col-span-1"
              label="MAJOR"
              options={availableMajorVersions}
              error={!!formState.errors?.majorVersion?.message}
              helperText={formState.errors?.majorVersion?.message}
              customOptionLabel={(value) => `Use custom value: "${value}"`}
            />
            <ControlledAutocomplete
              id="minorVersion"
              name="minorVersion"
              autoHighlight
              freeSolo
              disabled={versionFieldsDisabled}
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
              clearOnBlur
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
          {showMigrateWarning && <DatabaseMigrateDowntimeWarning />}
          {applicationUpdating && <DatabaseUpdateInProgressWarning />}
          {applicationUnhealthy && !isMigrating && (
            <DatabaseMigrateDisabledError />
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
