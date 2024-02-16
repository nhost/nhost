import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  disabled: Yup.boolean(),
});

export type DisableNewUsersFormValues = Yup.InferType<typeof validationSchema>;

export default function DisableNewUsersSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<DisableNewUsersFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      disabled: !data?.config?.auth?.signUp?.enabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading disabled sign up settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleDisableNewUsersChange = async (
    values: DisableNewUsersFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            signUp: {
              enabled: !values.disabled,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);
      },
      {
        loadingMessage: 'Disabling new user sign ups...',
        successMessage: 'New user sign ups have been disabled successfully.',
        errorMessage:
          'An error occurred while trying to disable new user sign ups.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDisableNewUsersChange}>
        <SettingsContainer
          title="Disable New Users"
          description="If set, newly registered users are disabled and won't be able to sign in."
          docsLink="https://docs.nhost.io/guides/auth/overview#disable-new-users"
          switchId="disabled"
          showSwitch
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}
