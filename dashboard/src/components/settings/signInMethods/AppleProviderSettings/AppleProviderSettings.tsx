import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
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
import { copy } from '@/utils/copy';
import { generateRemoteAppUrl } from '@/utils/helpers';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface AppleProviderFormValues {
  authAppleEnabled: boolean;
  authAppleTeamId: string;
  authAppleKeyId: string;
  authAppleClientId: string;
  authApplePrivateKey: string;
  authAppleScope: string;
}

export default function AppleProviderSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const {
    data: {
      app: {
        authAppleEnabled,
        authAppleTeamId,
        authAppleKeyId,
        authAppleClientId,
        authApplePrivateKey,
        authAppleScope,
      },
    },
    loading,
    error,
  } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<AppleProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authAppleTeamId,
      authAppleKeyId,
      authAppleClientId,
      authApplePrivateKey,
      authAppleScope,
      authAppleEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Apple settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('authAppleEnabled');

  const handleProviderUpdate = async (values: AppleProviderFormValues) => {
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
        loading: `Apple settings are being updated...`,
        success: `Apple settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Apple settings.`,
      },
      { ...toastStyleProps },
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Apple"
          description="Allows users to sign in with Apple."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-apple"
          docsTitle="how to sign in users with Apple"
          icon="/logos/Apple.svg"
          switchId="authAppleEnabled"
          showSwitch
          enabled={authEnabled}
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register(`authAppleTeamId`)}
            name="authAppleTeamId"
            id="authAppleTeamId"
            label="Team ID"
            placeholder="Apple Team ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authAppleScope')}
            name="authAppleScope"
            id="authAppleScope"
            label="Service ID"
            placeholder="Apple Service ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authAppleKeyId')}
            name="authAppleKeyId"
            id="authAppleKeyId"
            label="Key ID"
            placeholder="Apple Key ID"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authApplePrivateKey')}
            multiline
            rows={4}
            name="authApplePrivateKey"
            id="authApplePrivateKey"
            label="Private Key"
            placeholder="Paste Private Key here"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            name="redirectUrl"
            id="redirectUrl"
            placeholder={`${generateRemoteAppUrl(
              currentApplication.subdomain,
            )}/v1/auth/signin/provider/apple/callback`}
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
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
                      `${generateRemoteAppUrl(
                        currentApplication.subdomain,
                      )}/v1/auth/signin/provider/apple/callback`,
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
