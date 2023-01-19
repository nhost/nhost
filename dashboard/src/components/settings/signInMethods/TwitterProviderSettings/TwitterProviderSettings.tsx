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
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface TwitterProviderFormValues {
  authTwitterConsumerSecret: string;
  authTwitterConsumerKey: string;
  authTwitterEnabled: boolean;
}

export default function TwitterProviderSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication?.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<TwitterProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authTwitterConsumerSecret: data?.app?.authTwitterConsumerSecret,
      authTwitterConsumerKey: data?.app?.authTwitterConsumerKey,
      authTwitterEnabled: data?.app?.authTwitterEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Twitter settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('authTwitterEnabled');

  const handleProviderUpdate = async (values: TwitterProviderFormValues) => {
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
        loading: `Twitter settings are being updated...`,
        success: `Twitter settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Twitter settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Twitter"
          description="Allow users to sign in with Twitter."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsTitle="how to sign in users with Twitter"
          icon="/assets/brands/twitter.svg"
          switchId="authTwitterEnabled"
          showSwitch
          enabled={authEnabled}
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register(`authTwitterConsumerKey`)}
            name="authTwitterConsumerKey"
            id="authTwitterConsumerKey"
            label="Twitter Consumer Key"
            placeholder="Twitter Consumer Key"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authTwitterConsumerSecret')}
            name="authTwitterConsumerSecret"
            id="authTwitterConsumerSecret"
            label="Twitter Consumer Secret"
            placeholder="Twitter Consumer Secret"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            name="redirectUrl"
            id="redirectUrl"
            defaultValue={`${generateAppServiceUrl(
              currentApplication.subdomain,
              currentApplication.region.awsName,
              'auth',
            )}/signin/provider/twitter/callback`}
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
                      `${generateAppServiceUrl(
                        currentApplication.subdomain,
                        currentApplication.region.awsName,
                        'auth',
                      )}/signin/provider/twitter/callback`,
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
