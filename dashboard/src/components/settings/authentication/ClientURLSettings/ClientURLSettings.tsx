import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface ClientURLFormValues {
  /**
   * The URL of the frontend app of where users are redirected after authenticating.
   */
  authClientUrl: string;
}

export default function ClientURLSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { clientUrl } = data?.config?.auth?.redirections || {};

  const form = useForm<ClientURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authClientUrl: clientUrl,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading client URL settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState } = form;

  const handleClientURLChange = async (values: ClientURLFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Client URL is being updated...`,
        success: `Client URL has been updated successfully.`,
        error: `An error occurred while trying to update the project's Client URL.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleClientURLChange}>
        <SettingsContainer
          title="Client URL"
          description="This should be the URL of your frontend app where users are redirected after authenticating."
          slotProps={{
            submitButton: {
              disabled: !formState.isValid || !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/platform/authentication"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('authClientUrl')}
            name="authClientUrl"
            id="authClientUrl"
            placeholder="http://localhost:3000"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            aria-label="Client URL"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
