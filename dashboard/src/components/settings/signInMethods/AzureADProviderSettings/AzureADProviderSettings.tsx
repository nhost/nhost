import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useSignInMethodsQuery,
  useUpdateAppMutation
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import { copy } from '@/utils/copy';
import { generateRemoteAppUrl } from '@/utils/helpers';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface AzureADProviderFormValues{
  authAzureADEnabled: boolean;
  authAzureADClientId: string;
  authAzureADClientSecret: string;
  authAzureADTenantId: string;
}

export default function AzureADProviderSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<AzureADProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authAzureADClientId: data?.app?.authAzureADClientId,
      authAzureADClientSecret: data?.app?.authAzureADClientSecret,
      authAzureADTenantId: data?.app?.authAzureADTenantId,
      authAzureADEnabled: data?.app?.authAzureADEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading AzureAD Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('authAzureADEnabled');

  const handleProviderUpdate = async (
    values: AzureADProviderFormValues
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
        loading: `Azure AD settings are being updated...`,
        success: `Azure AD settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Azure AD settings.`,
      },
      { ...toastStyleProps },
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Azure AD"
          description="Allows users to sign in with Azure AD."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsTitle="how to sign in users with Azure AD"
          icon="/logos/AzureAD.svg"
          switchId="authAzureADEnabled"
          showSwitch
          enabled={authEnabled}
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          {/* <BaseProviderSettings /> */}
          <Input
          {...register('authAzureADClientId')}
          name="authAzureADClientId"
          id="authAzureADClientId"
          label="Azure AD Client ID"
          placeholder="Azure AD Client ID"
          className="col-span-3"
          fullWidth
          hideEmptyHelperText
          />
          <Input
          {...register('authAzureADClientSecret')}
          name="authAzureADClientSecret"
          id="authAzureADClientSecret"
          label="Azure AD Client Secret"
          placeholder="Azure AD Client Secret"
          className="col-span-3"
          fullWidth
          hideEmptyHelperText
          />
          <Input
          {...register('authAzureADTenantId')}
          name="authAzureADTenantId"
          id="authAzureADTenantId"
          label="Azure AD Tenant ID"
          placeholder="Azure AD Tenant ID"
          className="col-span-3"
          fullWidth
          hideEmptyHelperText
          />
          <Input
            name="redirectUrl"
            id="redirectUrl"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
            value={`https://${generateRemoteAppUrl(
              currentApplication.subdomain,
            )}.nhost.run/v1/auth/signin/provider/azuread/callback`}
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
                      `https://${generateRemoteAppUrl(
                        currentApplication.subdomain,
                      )}.nhost.run/v1/auth/signin/provider/azuread/callback`,
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
