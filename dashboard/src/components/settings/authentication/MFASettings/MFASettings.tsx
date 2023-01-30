import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useGetAuthSettingsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface MFASettingsFormValues {
  /**
   * One Time Password issuer
   */
  authMfaTotpIssuer: string;
  /**
   * Enable Multi Factor Authentication for this project
   */
  authMfaEnabled: boolean;
}

export default function MFASettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetAuthSettingsQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<MFASettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authMfaTotpIssuer: data?.app?.authMfaTotpIssuer,
      authMfaEnabled: data?.app?.authMfaEnabled,
    },
  });

  useEffect(() => {
    form.reset(() => ({
      authMfaTotpIssuer: data?.app?.authMfaTotpIssuer,
      authMfaEnabled: data?.app?.authMfaEnabled,
    }));
  }, [data?.app, form, form.reset]);

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
  const authMfaEnabled = watch('authMfaEnabled');

  const handleMFASettingsChange = async (values: MFASettingsFormValues) => {
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
        loading: `Multi-factor authentication settings are being updated...`,
        success: `Multi-factor authentication settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's multi-factor authentication settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleMFASettingsChange}>
        <SettingsContainer
          title="Multi-Factor Authentication"
          description="Enable users to use MFA to sign in"
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication#multi-factor-authentication"
          switchId="authMfaEnabled"
          enabled={authMfaEnabled}
          showSwitch
          className={twMerge(
            'grid grid-flow-row lg:grid-cols-5',
            !authMfaEnabled && 'hidden',
          )}
        >
          <Input
            {...register('authMfaTotpIssuer')}
            name="authMfaTotpIssuer"
            id="authMfaTotpIssuer"
            label="OTP Issuer"
            placeholder="Name of the One Time Password (OTP) issuer"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
