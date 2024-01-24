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
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  issuer: Yup.string().label('OTP Issuer').nullable().required(),
});

export type MFASettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function MFASettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { enabled, issuer } = data?.config?.auth?.totp || {};

  const form = useForm<MFASettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      issuer,
      enabled,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading multi-factor authentication settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authMfaEnabled = watch('enabled');

  const handleMFASettingsChange = async (values: MFASettingsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            totp: values,
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
        loadingMessage:
          'Multi-factor authentication settings are being updated...',
        successMessage:
          'Multi-factor authentication settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's multi-factor authentication settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleMFASettingsChange}>
        <SettingsContainer
          title="Multi-Factor Authentication"
          description="Enable users to use MFA to sign in"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#multi-factor-authentication"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid grid-flow-row lg:grid-cols-5',
            !authMfaEnabled && 'hidden',
          )}
        >
          <Input
            {...register('issuer')}
            name="issuer"
            id="issuer"
            label="OTP Issuer"
            placeholder="Name of the One Time Password (OTP) issuer"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.issuer}
            helperText={formState.errors?.issuer?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
