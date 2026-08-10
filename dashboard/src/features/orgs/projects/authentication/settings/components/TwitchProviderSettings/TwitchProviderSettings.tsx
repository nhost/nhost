import { yupResolver } from '@hookform/resolvers/yup';
import { useTheme } from '@mui/material';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import type { BaseProviderSettingsFormValues } from '@/features/orgs/projects/authentication/settings/components/BaseProviderSettings';
import {
  BaseProviderSettings,
  baseProviderValidationSchema,
} from '@/features/orgs/projects/authentication/settings/components/BaseProviderSettings';
import { ProviderRedirectUrlInput } from '@/features/orgs/projects/authentication/settings/components/ProviderRedirectUrlInput';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

export default function TwitchProviderSettings() {
  const theme = useTheme();
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { clientId, clientSecret, enabled } =
    data?.config?.auth?.method?.oauth?.twitch || {};

  const form = useForm<BaseProviderSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(baseProviderValidationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        enabled: enabled || false,
      });
    }
  }, [loading, clientId, clientSecret, enabled, form]);

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: BaseProviderSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            method: {
              oauth: {
                twitch: {
                  ...formValues,
                  scope: [],
                },
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

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
        loadingMessage: 'Twitch settings are being updated...',
        successMessage: 'Twitch settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Twitch settings.",
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Twitch"
            description="Allow users to sign in with Twitch."
            icon={
              theme.palette.mode === 'dark'
                ? '/assets/brands/light/twitch.svg'
                : '/assets/brands/twitch.svg'
            }
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Twitch"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'grid grid-flow-row grid-cols-2 grid-rows-2 gap-x-3 gap-y-4 px-4 py-2',
              !authEnabled && 'hidden',
            )}
          >
            <BaseProviderSettings />
            <ProviderRedirectUrlInput
              id="twitch-redirectUrl"
              value={`${generateAppServiceUrl(
                project!.subdomain,
                project!.region,
                'auth',
              )}/signin/provider/twitch/callback`}
              className="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/providers/sign-in-twitch"
              title="how to sign in users with Twitch"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
