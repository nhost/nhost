import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { filterOptions } from '@/components/ui/v2/Autocomplete';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetAuthenticationSettingsDocument,
  Software_Type_Enum,
  useGetAuthenticationSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Auth version is being updated...`,
          success: `Auth version has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update Auth version.`,
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
          className="grid grid-flow-row gap-y-2 gap-x-4 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
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
