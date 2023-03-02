import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  clientUrl: Yup.string().label('Client URL'),
});

export type ClientURLFormValues = Yup.InferType<typeof validationSchema>;

export default function ClientURLSettings() {
  const { maintenanceActive } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { clientUrl, allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<ClientURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientUrl,
    },
    resolver: yupResolver(validationSchema),
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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            redirections: {
              ...values,
              allowedUrls,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Client URL is being updated...`,
          success: `Client URL has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's Client URL.`,
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
      <Form onSubmit={handleClientURLChange}>
        <SettingsContainer
          title="Client URL"
          description="This should be the URL of your frontend app where users are redirected after authenticating."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#client-url"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('clientUrl')}
            name="clientUrl"
            id="clientUrl"
            placeholder="http://localhost:3000"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            aria-label="Client URL"
            error={!!formState.errors?.clientUrl}
            helperText={formState.errors?.clientUrl?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
