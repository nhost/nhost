import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  version: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  })
    .label('Postgres Version')
    .required(),
});

export type DatabaseServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DatabaseServiceVersionSettings() {
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetPostgresSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const [selectedMajor, setSelectedMajor] = useState(null);
  const [selectedMinor, setSelectedMinor] = useState(null);

  const { data, loading, error } = useGetPostgresSettingsQuery({
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

  const databaseVersions = databaseVersionsData?.softwareVersions || [];

  /// Structure the Available Versions
  const structuredVersions = databaseVersions.map((v) => {
    const [majorMinor, ...rest] = v.version.split('-');
    const [major, minor] = majorMinor.split('.');
    return {
      major,
      minor: `${minor}-${rest.join('-')}`, // Ensure the minor version concatenates properly
      full: v.version,
    };
  });

  const availableVersions = Array.from(
    new Set(databaseVersions.map((el) => el.version)).add(version),
  )
    .sort()
    .reverse()
    .map((availableVersion) => ({
      label: availableVersion,
      value: availableVersion,
    }));

  console.log('Available Versions:', availableVersions);

  const availableMinors = useMemo(() => {
    const minors = structuredVersions
      .filter((v) => v.major === selectedMajor)
      .sort()
      .map((v) => ({
        label: v.minor,
        value: v.full,
      }));
    console.log('Available Minors for Major', selectedMajor, ':', minors);
    return minors;
  }, [selectedMajor, structuredVersions]);

  const uniqueMajors = Array.from(
    new Set(structuredVersions.map((v) => v.major)),
  ).map((major) => ({
    label: major,
    value: major,
  }));

  useEffect(() => {
    // Check if the current selected minor is still valid for the new major
    const currentMinorIsValid = availableMinors.some(
      (minor) => minor.value === selectedMinor,
    );

    if (!currentMinorIsValid && availableMinors.length > 0) {
      console.log(
        'Updating minor to first available for new major:',
        availableMinors[0].value,
      );
      setSelectedMinor(availableMinors[0].value);
    } else if (!currentMinorIsValid) {
      setSelectedMinor(null);
    }
  }, [availableMinors, selectedMinor]);

  const handleMajorChange = (_event, newValue) => {
    console.log(
      'Changing major from',
      selectedMajor,
      'to',
      newValue?.value || 'null',
    );
    setSelectedMajor(newValue?.value || null);
  };

  const handleMinorChange = (_event, newValue) => {
    console.log(
      'Changing minor from',
      selectedMinor,
      'to',
      newValue?.value || '',
    );
    setSelectedMinor(newValue?.value || '');
  };

  const form = useForm<DatabaseServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: { label: '', value: '' } },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && version) {
      // Example version: "14.11-20240508-beta01"
      const firstDotIndex = version.indexOf('.'); // Find the first period
      const major = version.substring(0, firstDotIndex); // Get substring before the first dot
      const minor = version.substring(firstDotIndex + 1); // Get everything after the first dot

      setSelectedMajor(major);
      setSelectedMinor(minor); // This should now correctly be "11-20240508-beta01"

      // Reset the form with structured version data
      form.reset({
        version: {
          label: version,
          value: version,
        },
      });
    }
  }, [loading, version, form]);

  console.log('Selected Major:', selectedMajor);
  console.log('Selected Minor:', selectedMinor);

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

  const handleDatabaseServiceVersionsChange = async (
    formValues: DatabaseServiceVersionFormValues,
  ) => {
    // Ensure both major and minor versions are selected
    if (selectedMajor && selectedMinor) {
      // Construct the full version string
      const fullVersion = `${selectedMajor}.${selectedMinor}`;

      // Log the full version to debug
      console.log('Submitting Full Version:', fullVersion);

      // Call your update configuration mutation
      const updateConfigPromise = updateConfig({
        variables: {
          appId: currentProject.id,
          config: {
            postgres: {
              version: fullVersion, // Use the combined version string
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
    }
  };

  console.log('Unique Majors:', uniqueMajors);

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
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
            name="majorVersion"
            label="MAJOR"
            options={uniqueMajors}
            // options={uniqueMajors.map((major) => ({
            //   label: major as unknown as string,
            //   value: major as unknown as string,
            // }))}
            onChange={handleMajorChange}
            // value={
            //   uniqueMajors.find((major) => major.value === selectedMajor) ||
            //   null
            // }
            value={
              uniqueMajors.find((major) => major === selectedMajor)
                ? { label: selectedMajor, value: selectedMajor }
                : null
            }
            fullWidth
            className="lg:col-span-2"
            freeSolo
            autoHighlight
            error={!!formState.errors?.version?.message}
            helperText={formState.errors?.version?.message}
          />
          <ControlledAutocomplete
            key={selectedMajor || 'major'}
            name="minorVersion"
            label="MINOR"
            onChange={handleMinorChange}
            value={
              availableMinors.find((minor) => minor.value === selectedMinor) ||
              null
            }
            options={availableMinors}
            isOptionEqualToValue={() => false}
            customOptionLabel={(value) => `Use custom value: "${value}"`}
            fullWidth
            className="lg:col-span-2"
            freeSolo
            autoHighlight
            error={!!formState.errors?.version?.message}
            helperText={formState.errors?.version?.message}
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
          />
          {/* <ControlledAutocomplete
            id="version"
            name="version"
            autoHighlight
            freeSolo
            getOptionLabel={(option) => {
              if (typeof option === 'string') {
                return option || '';
              }

              console.log('getOptionLabel:', option.value);
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
            options={availableVersions}
            error={!!formState.errors?.version?.message}
            helperText={formState.errors?.version?.message}
            showCustomOption="auto"
            customOptionLabel={(value) => `Use custom value: "${value}"`}
          /> */}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
