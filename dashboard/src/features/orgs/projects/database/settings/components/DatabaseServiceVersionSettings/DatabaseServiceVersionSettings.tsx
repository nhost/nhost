import { yupResolver } from '@hookform/resolvers/yup';
import { RepeatIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormFreeCombobox } from '@/components/form/FormFreeCombobox';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useGetPostgresVersion } from '@/features/orgs/projects/database/common/hooks/useGetPostgresVersion';
import { useIsDatabaseMigrating } from '@/features/orgs/projects/database/common/hooks/useIsDatabaseMigrating';
import { DatabaseMigrateDisabledError } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateDisabledError';
import { DatabaseMigrateDowntimeWarning } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateDowntimeWarning';
import { DatabaseMigrateLogsModal } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateLogsModal';
import { DatabaseMigrateVersionConfirmationDialog } from '@/features/orgs/projects/database/settings/components/DatabaseMigrateVersionConfirmationDialog';
import { splitPostgresMajorMinorVersions } from '@/features/orgs/projects/database/settings/utils/splitPostgresMajorMinorVersions';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetPostgresSettingsDocument,
  Software_Type_Enum,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

const validationSchema = Yup.object({
  majorVersion: Yup.string()
    .label('Postgres major version')
    .required('Major version is a required field')
    .test(
      'must-be-positive-number',
      'Invalid major version',
      (value) => Number(value) > 0,
    ),
  minorVersion: Yup.string()
    .label('Postgres minor version')
    .required('Minor version is a required field'),
});

export type DatabaseServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DatabaseServiceVersionSettings() {
  const isPlatform = useIsPlatform();
  const { openDialog, closeDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetPostgresSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    version: postgresVersion,
    major: currentPostgresMajor,
    minor: currentPostgresMinor,
    error: postgresSettingsError,
    loading: loadingPostgresSettings,
  } = useGetPostgresVersion();

  const { data: databaseVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.PostgreSql,
    },
    skip: !isPlatform,
  });

  const availableVersions = useMemo(() => {
    const databaseVersions = databaseVersionsData?.softwareVersions || [];
    const optionsSet = new Set(databaseVersions.map((el) => el.version));
    if (isNotEmptyValue(postgresVersion)) {
      optionsSet.add(postgresVersion);
    }

    return Array.from(optionsSet)
      .sort()
      .map((availableVersion) => ({
        label: availableVersion,
        value: availableVersion,
      }));
  }, [postgresVersion, databaseVersionsData?.softwareVersions]);

  const form = useForm<DatabaseServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      minorVersion: '',
      majorVersion: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { formState, watch } = form;

  const selectedMajor = watch('majorVersion');
  const selectedMinor = watch('minorVersion');

  const getMajorAndMinorVersions = (): {
    availableMajorVersions: { label: string; value: string }[];
    majorToMinorVersions: Record<string, { label: string; value: string }[]>;
  } => {
    const minorVersionByMajor = {};
    const majorVersions: { label: string; value: string }[] = [];
    availableVersions.forEach((availableVersion) => {
      if (!availableVersion.value) {
        return;
      }
      const { major, minor } = splitPostgresMajorMinorVersions(
        availableVersion.value,
      );

      // Don't suggest versions that are lower than the current Postgres major version (can't downgrade)
      if (Number(major) < Number(currentPostgresMajor)) {
        return;
      }

      if (majorVersions.every((item) => item.value !== major)) {
        majorVersions.push({
          label: major,
          value: major,
        });
      }

      if (!minorVersionByMajor[major]) {
        minorVersionByMajor[major] = [];
      }

      if (isNotEmptyValue(minor)) {
        minorVersionByMajor[major].push({
          label: minor,
          value: minor,
        });
      }
    });
    return {
      availableMajorVersions: majorVersions,
      majorToMinorVersions: minorVersionByMajor,
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
        majorVersion: currentPostgresMajor,
        minorVersion: currentPostgresMinor,
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

  const majorVersionFieldDisabled = applicationUnhealthy;

  const handleDatabaseServiceVersionsChange = async (
    formValues: DatabaseServiceVersionFormValues,
  ) => {
    const newVersion = `${formValues.majorVersion}.${formValues.minorVersion}`;

    // Major version change
    if (isMajorVersionDirty && applicationLive) {
      openDialog({
        title: 'Update Postgres MAJOR version',
        component: (
          <DatabaseMigrateVersionConfirmationDialog
            postgresVersion={newVersion}
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
        appId: project?.id,
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

  if (postgresSettingsError) {
    throw postgresSettingsError;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDatabaseServiceVersionsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Postgres Version"
            description="The version of Postgres to use."
            actions={
              shouldShowUpgradeLogs ? (
                <Button
                  variant="outline"
                  className="self-center"
                  onClick={openLatestUpgradeLogsModal}
                >
                  <RepeatIcon className="mr-2 h-4 w-4" />
                  View latest upgrade logs
                </Button>
              ) : null
            }
          />

          <SettingsCardContent className="flex flex-col">
            <div className="grid grid-flow-row gap-x-4 gap-y-2 lg:grid-cols-5">
              <FormFreeCombobox
                name="majorVersion"
                containerClassName="lg:col-span-2"
                label="MAJOR"
                options={availableMajorVersions}
                control={form.control}
                disabled={majorVersionFieldDisabled}
                placeholder="Select Major"
                customValueLabel={(val) => `Use custom value: "${val}"`}
                onChange={(value) => {
                  if (value && value !== selectedMajor) {
                    const nextAvailableMinorVersions =
                      majorToMinorVersions[value] || [];

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
                        nextAvailableMinorVersions[0].value,
                      );
                    }
                  }
                }}
              />
              <FormFreeCombobox
                name="minorVersion"
                containerClassName="lg:col-span-3"
                label="MINOR"
                options={availableMinorVersions}
                control={form.control}
                placeholder="Select Minor"
                customValueLabel={(val) => `Use custom value: "${val}"`}
              />
            </div>
            {showMigrateWarning && <DatabaseMigrateDowntimeWarning />}
            {applicationUnhealthy && !isMigrating && (
              <DatabaseMigrateDisabledError />
            )}
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hub.docker.com/r/nhost/postgres/tags"
              title="the latest releases"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
