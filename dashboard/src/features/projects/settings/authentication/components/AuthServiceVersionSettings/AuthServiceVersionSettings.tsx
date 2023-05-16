import { ControlledSelect } from '@/components/common/ControlledSelect';
import { Form } from '@/components/common/Form';
import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Option } from '@/ui/v2/Option';
import { getServerError } from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  version: Yup.string().label('Hasura Auth Version'),
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

  const { version } = data?.config?.auth || {};
  const availableVersions = Array.from(
    new Set(['0.20.0', '0.19.3', '0.19.2', '0.19.1', '0.16.2', '0.16.1']).add(
      version,
    ),
  )
    .sort()
    .reverse();

  const form = useForm<AuthServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version },
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
    values: AuthServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            version: values.version,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Hasura Auth version is being updated...`,
          success: `Hasura Auth version has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update Hasura Auth's version.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(values);
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
          className="grid grid-flow-row px-4 lg:grid-cols-5"
        >
          <ControlledSelect
            id="version"
            name="version"
            fullWidth
            className="col-span-2"
            aria-label="Hasura Auth Version"
          >
            {availableVersions.map((availableVersion) => (
              <Option value={availableVersion} key={availableVersion}>
                {availableVersion}
              </Option>
            ))}
          </ControlledSelect>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
