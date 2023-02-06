import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import type { BaseProviderSettingsFormValues } from '@/components/settings/signInMethods/BaseProviderSettings';
import BaseProviderSettings from '@/components/settings/signInMethods/BaseProviderSettings';
import {
  useSignInMethodsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export default function WindowsLiveProviderSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<BaseProviderSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authClientId: data?.app?.authWindowsLiveClientId,
      authClientSecret: data?.app?.authWindowsLiveClientSecret,
      authEnabled: data?.app?.authWindowsLiveEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Windows Live Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('authEnabled');

  const handleProviderUpdate = async (
    values: BaseProviderSettingsFormValues,
  ) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authWindowsLiveClientId: values.authClientId,
          authWindowsLiveClientSecret: values.authClientSecret,
          authWindowsLiveEnabled: values.authEnabled,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Windows Live settings are being updated...`,
        success: `Windows Live settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Windows Live settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Windows Live"
          description="Allow users to sign in with Windows Live."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsTitle="how to sign in users with Windows Live"
          icon="/assets/brands/windowslive.svg"
          switchId="authEnabled"
          showSwitch
          enabled={authEnabled}
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <BaseProviderSettings />
          <Input
            name="redirectUrl"
            id="redirectUrl"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
            defaultValue={`${generateAppServiceUrl(
              currentApplication.subdomain,
              currentApplication.region.awsName,
              'auth',
            )}/signin/provider/windowslive/callback`}
            disabled
            endAdornment={
              <InputAdornment position="end" className="absolute right-2">
                <IconButton
                  sx={{ minWidth: 0, padding: 0 }}
                  color="secondary"
                  variant="borderless"
                  onClick={(e) => {
                    e.stopPropagation();
                    copy(
                      `${generateAppServiceUrl(
                        currentApplication.subdomain,
                        currentApplication.region.awsName,
                        'auth',
                      )}/signin/provider/windowslive/callback`,
                      'Redirect URL',
                    );
                  }}
                >
                  <CopyIcon className="w-4 h-4" />
                </IconButton>
              </InputAdornment>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
