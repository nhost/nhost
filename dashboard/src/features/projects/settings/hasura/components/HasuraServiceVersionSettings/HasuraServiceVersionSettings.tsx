import { ControlledAutocomplete } from '@/components/common/ControlledAutocomplete';
import { Form } from '@/components/common/Form';
import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { filterOptions } from '@/components/ui/v2/Autocomplete';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useDockerImageTags } from '@/features/projects/settings/common/hooks/useDockerImageTags';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { getServerError } from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  version: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  })
    .label('Hasura Version')
    .required(),
});

export type HasuraServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraServiceVersionSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const {
    data: tags,
    error: dockerError,
    status: dockerStatus,
  } = useDockerImageTags({ image: 'hasura/graphql-engine' });

  const { version } = data?.config?.hasura || {};
  const availableVersions = Array.from(new Set(tags).add(version))
    .sort()
    .reverse()
    .map((tag) => ({ label: tag, value: tag }));

  const form = useForm<HasuraServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: { label: version, value: version } },
    resolver: yupResolver(validationSchema),
  });

  // We don't want to hide the form while the docker tags are being fetched
  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Hasura version..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { control, formState } = form;

  const handleHasuraServiceVersionsChange = async (
    formValues: HasuraServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            version: formValues.version.value,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Hasura version is being updated...`,
          success: `Hasura version has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update Hasura version.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
    } catch {
      // Note: The toast will handle the error.
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleHasuraServiceVersionsChange}>
        <SettingsContainer
          title="Hasura GraphQL Engine Version"
          description="The version of the Hasura GraphQL Engine to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://github.com/hasura/graphql-engine/releases"
          docsTitle="the latest releases"
          className="grid grid-flow-row gap-y-2 gap-x-4 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
            control={control}
            id="version"
            name="version"
            filterOptions={(options, state) => {
              if (state.inputValue === version) {
                return options;
              }

              return filterOptions(options, state);
            }}
            fullWidth
            className="lg:col-span-2"
            options={availableVersions}
            error={
              !!formState.errors?.version?.message || !!dockerError?.message
            }
            helperText={
              formState.errors?.version?.message || dockerError?.message
            }
            showCustomOption
            customOptionLabel={(value) => `Use "${value}"`}
            loading={dockerStatus === 'loading'}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
