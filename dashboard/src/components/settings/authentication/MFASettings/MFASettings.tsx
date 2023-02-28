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
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  issuer: Yup.string().label('OTP Issuer').nullable().required(),
});

export type MFASettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function MFASettings() {
  const { projectManagementDisabled } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
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
        appId: currentApplication.id,
        config: {
          auth: {
            totp: values,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Multi-factor authentication settings are being updated...`,
          success: `Multi-factor authentication settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's multi-factor authentication settings.`,
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
      <Form onSubmit={handleMFASettingsChange}>
        <SettingsContainer
          title="Multi-Factor Authentication"
          description="Enable users to use MFA to sign in"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || projectManagementDisabled,
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
