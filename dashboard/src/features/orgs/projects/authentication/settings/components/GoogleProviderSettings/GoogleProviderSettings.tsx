/** biome-ignore-all lint/suspicious/noThenProperty: yup thing */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
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

const googleProviderValidationSchema = Yup.object({
  clientId: Yup.string()
    .label('Client ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  clientSecret: Yup.string()
    .label('Client Secret')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  audience: Yup.string().label('Audience'),
  enabled: Yup.bool(),
});

export type GoogleProviderFormValues = Yup.InferType<
  typeof googleProviderValidationSchema
>;

export default function GoogleProviderSettings() {
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

  const { clientId, clientSecret, enabled, audience } =
    data?.config?.auth?.method?.oauth?.google || {};

  const form = useForm<GoogleProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      audience: audience || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(googleProviderValidationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        audience: audience || '',
        enabled: enabled || false,
      });
    }
  }, [loading, clientId, clientSecret, audience, enabled, form]);

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
                google: {
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
        loadingMessage: 'Google settings are being updated...',
        successMessage: 'Google settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Google settings.",
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Google"
            description="Allow users to sign in with Google."
            icon="/assets/brands/google.svg"
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Google"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'grid grid-flow-row grid-cols-2 grid-rows-3 gap-x-3 gap-y-4 px-4 py-2',
              !authEnabled && 'hidden',
            )}
          >
            <FormInput
              control={form.control}
              name="clientId"
              label="Client ID"
              placeholder="Enter your Client ID"
              containerClassName="col-span-1"
            />
            <FormInput
              control={form.control}
              name="clientSecret"
              label="Client Secret"
              placeholder="Enter your Client Secret"
              containerClassName="col-span-1"
            />
            <FormInput
              control={form.control}
              name="audience"
              label="Audience, set it to enable idtokens (optional)"
              placeholder="GoogleAudience1,GoogleAudience2"
              containerClassName="col-span-2"
            />
            <ProviderRedirectUrlInput
              id="google-redirectUrl"
              value={`${generateAppServiceUrl(
                project!.subdomain,
                project!.region,
                'auth',
              )}/signin/provider/google/callback`}
              className="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/providers/sign-in-google"
              title="how to sign in users with Google"
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
