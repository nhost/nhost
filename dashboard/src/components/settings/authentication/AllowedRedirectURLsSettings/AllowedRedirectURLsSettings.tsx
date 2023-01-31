import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useGetAppQuery, useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface AllowedRedirectURLFormValues {
  /**
   * Set of URLs that are allowed to be redirected to after project's users authentication.
   */
  authAccessControlAllowedRedirectUrls: string;
}

export default function AllowedRedirectURLsSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetAppQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<AllowedRedirectURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authAccessControlAllowedRedirectUrls:
        data?.app?.authAccessControlAllowedRedirectUrls,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading allowed redirect URL settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState } = form;

  const handleAllowedRedirectURLsChange = async (
    values: AllowedRedirectURLFormValues,
  ) => {
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
        loading: `Allowed redirect URL settings are being updated...`,
        success: `Allowed redirect URL settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's allowed redirect URL settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedRedirectURLsChange}>
        <SettingsContainer
          title="Allowed Redirect URLs"
          description="Allowed URLs where users can be redirected to after authentication. Separate multiple redirect URLs with comma."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication#allowed-redirect-urls"
          className="grid grid-flow-row px-4 lg:grid-cols-5"
        >
          <Input
            {...register('authAccessControlAllowedRedirectUrls')}
            name="authAccessControlAllowedRedirectUrls"
            id="authAccessControlAllowedRedirectUrls"
            placeholder="http://localhost:3000, http://localhost:4000"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            aria-label="Allowed Redirect URLs"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
