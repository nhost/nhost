import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import {
  ControlledAutocomplete,
  defaultFilterOptions,
} from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  Software_Type_Enum,
  useGetSoftwareVersionsQuery,
  useGetStorageSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';

const validationSchema = Yup.object({
  version: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  })
    .label('Storage Version')
    .required(),
});

export type StorageServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function StorageServiceVersionSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetStorageSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data: storageVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Storage,
    },
    skip: !isPlatform,
  });

  const { version } = data?.config?.storage || {};

  const availableVersions = useMemo(() => {
    const versions = storageVersionsData?.softwareVersions || [];

    if (isEmptyValue(versions)) {
      return [];
    }
    const versionSet = new Set(versions.map((el) => el.version));
    if (version) {
      versionSet.add(version);
    }
    return Array.from(versionSet)
      .sort()
      .reverse()
      .map((availableVersion) => ({
        label: availableVersion,
        value: availableVersion,
      }));
  }, [storageVersionsData?.softwareVersions, version]);

  const form = useForm<StorageServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: { label: '', value: '' } },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        version: {
          label: version as string,
          value: version as string,
        },
      });
    }
  }, [loading, version, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Storage version..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleStorageServiceVersionsChange = async (
    formValues: StorageServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          storage: {
            version: formValues.version.value,
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
        loadingMessage: 'Storage version is being updated...',
        successMessage: 'Storage version has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Storage version.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleStorageServiceVersionsChange}>
        <SettingsContainer
          title="Storage Version"
          description="The version of Storage to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://github.com/nhost/hasura-storage/releases"
          docsTitle="the latest releases"
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
            id="version"
            name="version"
            autoHighlight
            freeSolo
            getOptionLabel={(option) => {
              if (typeof option === 'string') {
                return option || '';
              }

              return option.value;
            }}
            isOptionEqualToValue={() => false}
            filterOptions={defaultFilterOptions}
            fullWidth
            className="lg:col-span-2"
            options={availableVersions}
            error={!!formState.errors?.version?.message}
            helperText={formState.errors?.version?.message}
            showCustomOption="auto"
            customOptionLabel={(value) => `Use custom value: "${value}"`}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
