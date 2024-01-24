import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  allowedUrls: Yup.string().label('Allowed Redirect URLs'),
});

export type AllowedRedirectURLFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AllowedRedirectURLsSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<AllowedRedirectURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      allowedUrls: allowedUrls?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            redirections: {
              allowedUrls: values.allowedUrls
                ? values.allowedUrls.split(',').map((url) => url.trim())
                : [],
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
        loadingMessage: 'Allowed redirect URL settings are being updated...',
        successMessage:
          'Allowed redirect URL settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's allowed redirect URL settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedRedirectURLsChange}>
        <SettingsContainer
          title="Allowed Redirect URLs"
          description="Allowed URLs where users can be redirected to after authentication. Separate multiple redirect URLs with comma."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#allowed-redirect-urls"
          className="grid grid-flow-row px-4 lg:grid-cols-5"
        >
          <Input
            {...register('allowedUrls')}
            name="allowedUrls"
            id="allowedUrls"
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
