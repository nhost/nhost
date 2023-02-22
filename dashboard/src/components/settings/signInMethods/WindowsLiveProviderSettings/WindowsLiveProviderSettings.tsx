import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import type { BaseProviderSettingsFormValues } from '@/components/settings/signInMethods/BaseProviderSettings';
import BaseProviderSettings, {
  baseProviderValidationSchema,
} from '@/components/settings/signInMethods/BaseProviderSettings';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export default function WindowsLiveProviderSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { clientId, clientSecret, enabled } =
    data?.config?.auth?.method?.oauth?.windowslive || {};

  const form = useForm<BaseProviderSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(baseProviderValidationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Windows Live..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('enabled');

  const handleProviderUpdate = async (
    values: BaseProviderSettingsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            method: {
              oauth: {
                windowslive: {
                  ...values,
                  scope: [],
                },
              },
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Windows Live settings are being updated...`,
          success: `Windows Live settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's Windows Live settings.`,
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
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Windows Live"
          description="Allow users to sign in with Windows Live."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsTitle="how to sign in users with Windows Live"
          icon="/assets/brands/windowslive.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <BaseProviderSettings providerName="windowslive" />
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
                  <CopyIcon className="h-4 w-4" />
                </IconButton>
              </InputAdornment>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
