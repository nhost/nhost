import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetAuthenticationSettingsDocument,
  Software_Type_Enum,
  useGetAuthenticationSettingsQuery,
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
  }).label('Auth Version'),
});

export type AuthServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AuthServiceVersionSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { data: authVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Auth,
    },
  });

  const { version } = data?.config?.auth || {};
  const versions = authVersionsData?.softwareVersions || [];
  const availableVersions = Array.from(
    new Set(versions.map((el) => el.version)).add(version),
  )
    .sort()
    .reverse()
    .map((availableVersion) => ({
      label: availableVersion,
      value: availableVersion,
    }));

  const form = useForm<AuthServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: { label: version, value: version } },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Auth version..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleAuthServiceVersionsChange = async (
    formValues: AuthServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            version: formValues.version.value,
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
      },
      {
        loadingMessage: 'Auth version is being updated...',
        successMessage: 'Auth version has been updated successfully.',
        errorMessage: 'An error occurred while trying to update Auth version.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAuthServiceVersionsChange}>
        <SettingsContainer
          title="Auth Version"
          description="The version of Auth to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://github.com/nhost/hasura-auth/releases"
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
