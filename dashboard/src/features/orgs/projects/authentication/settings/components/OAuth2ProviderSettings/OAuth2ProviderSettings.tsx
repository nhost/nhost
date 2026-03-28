import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetOAuth2ProviderSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  loginURL: Yup.string().label('Login URL').required(),
  accessTokenExpiresIn: Yup.number()
    .label('Access token expiration')
    .typeError('Access token expiration must be a number')
    .required(),
  refreshTokenExpiresIn: Yup.number()
    .label('Refresh token expiration')
    .typeError('Refresh token expiration must be a number')
    .required(),
  clientIdMetadataDocumentEnabled: Yup.boolean().label(
    'Client ID Metadata Document',
  ),
});

export type OAuth2ProviderSettingsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function OAuth2ProviderSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetOAuth2ProviderSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const oauth2Provider = data?.config?.auth?.oauth2Provider;
  const enabled = !!oauth2Provider?.enabled;
  const loginURL = oauth2Provider?.loginURL ?? '';
  const accessTokenExpiresIn = oauth2Provider?.accessToken?.expiresIn ?? 900;
  const refreshTokenExpiresIn =
    oauth2Provider?.refreshToken?.expiresIn ?? 43200;
  const clientIdMetadataDocumentEnabled =
    !!oauth2Provider?.clientIdMetadataDocument?.enabled;

  const form = useForm<OAuth2ProviderSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled,
      loginURL,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      clientIdMetadataDocumentEnabled,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled,
        loginURL,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        clientIdMetadataDocumentEnabled,
      });
    }
  }, [
    loading,
    enabled,
    loginURL,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
    clientIdMetadataDocumentEnabled,
    form,
  ]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading OAuth2 provider settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const oauth2Enabled = watch('enabled');

  const handleSubmit = async (values: OAuth2ProviderSettingsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            oauth2Provider: {
              enabled: values.enabled,
              loginURL: values.loginURL,
              accessToken: { expiresIn: values.accessTokenExpiresIn },
              refreshToken: { expiresIn: values.refreshTokenExpiresIn },
              clientIdMetadataDocument: {
                enabled: values.clientIdMetadataDocumentEnabled,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'OAuth2 provider settings are being updated...',
        successMessage:
          'OAuth2 provider settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's OAuth2 provider settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="OAuth2 Provider"
          description={
            <>
              Enable the OAuth2 provider to allow third-party applications to
              authenticate users via OAuth2.
            </>
          }
          docsLink="https://docs.nhost.io/products/auth/oauth2-provider"
          docsTitle="OAuth2 Providers"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          switchId="enabled"
          showSwitch
          className={cn('grid grid-cols-5 gap-y-6', !oauth2Enabled && 'hidden')}
        >
          <Input
            {...register('loginURL')}
            id="loginURL"
            label="Login URL"
            placeholder="https://example.com/oauth2/login"
            helperText={
              formState.errors.loginURL?.message || (
                <>
                  The authorization/consent page URL for the OAuth2 flow. Learn
                  more about{' '}
                  <Link
                    href="https://docs.nhost.io/products/auth/oauth2-provider/authorization-flow/#what-you-build-the-consent-page"
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    className="font-medium"
                  >
                    building the consent page
                    <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
                  </Link>
                </>
              )
            }
            fullWidth
            className="col-span-5"
            error={Boolean(formState.errors.loginURL?.message)}
            hideEmptyHelperText
          />

          <Input
            {...register('accessTokenExpiresIn')}
            id="accessTokenExpiresIn"
            type="number"
            label="Access Token Expires In (Seconds)"
            fullWidth
            className="col-span-5 lg:col-span-2"
            error={Boolean(formState.errors.accessTokenExpiresIn?.message)}
            helperText={formState.errors.accessTokenExpiresIn?.message}
          />

          <Input
            {...register('refreshTokenExpiresIn')}
            id="refreshTokenExpiresIn"
            type="number"
            label="Refresh Token Expires In (Seconds)"
            fullWidth
            className="col-span-5 lg:col-span-2"
            error={Boolean(formState.errors.refreshTokenExpiresIn?.message)}
            helperText={formState.errors.refreshTokenExpiresIn?.message}
          />

          <div className="col-span-5 flex items-center justify-between">
            <div>
              <Text className="font-medium">Client ID Metadata Document</Text>
              <Text className="text-muted-foreground text-sm">
                Enable the client ID metadata document endpoint for client
                discovery.
              </Text>
            </div>
            <ControlledSwitch
              name="clientIdMetadataDocumentEnabled"
              disabled={maintenanceActive}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
