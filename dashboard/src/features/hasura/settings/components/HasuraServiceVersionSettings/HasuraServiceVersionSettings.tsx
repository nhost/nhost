import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetHasuraSettingsDocument,
  Software_Type_Enum,
  useGetHasuraSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
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
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { data: hasuraVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Hasura,
    },
  });

  const { version } = data?.config?.hasura || {};
  const versions = hasuraVersionsData?.softwareVersions || [];
  const availableVersions = Array.from(
    new Set(versions.map((el) => el.version)).add(version),
  )
    .sort()
    .reverse()
    .map((availableVersion) => ({
      label: availableVersion,
      value: availableVersion,
    }));

  const form = useForm<HasuraServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: { label: version, value: version } },
    resolver: yupResolver(validationSchema),
  });

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

  const { formState } = form;

  async function handleSubmit(formValues: HasuraServiceVersionFormValues) {
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

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchWorkspaceAndProject();
      },
      {
        loadingMessage: 'Hasura version is being updated...',
        successMessage: 'Hasura version has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Hasura version.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Hasura GraphQL Engine Version"
          description="The version of the Hasura GraphQL Engine to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://hub.docker.com/r/nhost/graphql-engine/tags"
          docsTitle="the latest releases"
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
            id="version"
            name="version"
            autoHighlight
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
            aria-label="Hasura Service Version"
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
