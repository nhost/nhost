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
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
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

const validationSchema = Yup.object({
  consumerSecret: Yup.string()
    .label('Consumer Secret')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  consumerKey: Yup.string()
    .label('Consumer Key')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  enabled: Yup.boolean(),
});

export type TwitterProviderFormValues = Yup.InferType<typeof validationSchema>;

export default function TwitterProviderSettings() {
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

  const { consumerKey, consumerSecret, enabled } =
    data?.config?.auth?.method?.oauth?.twitter || {};

  const form = useForm<TwitterProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      consumerSecret: consumerSecret || '',
      consumerKey: consumerKey || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        consumerSecret: consumerSecret || '',
        consumerKey: consumerKey || '',
        enabled: enabled || false,
      });
    }
  }, [loading, consumerKey, consumerSecret, enabled, form]);

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: TwitterProviderFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            method: {
              oauth: {
                twitter: formValues,
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
        loadingMessage: 'Twitter settings are being updated...',
        successMessage: 'Twitter settings have been updated successfully.',
        errorMessage: `An error occurred while trying to update the project's Twitter settings.`,
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Twitter"
            description="Allow users to sign in with Twitter."
            icon="/assets/brands/twitter.svg"
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Twitter"
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
            <FormInput
              control={form.control}
              name="consumerKey"
              label="Twitter Consumer Key"
              placeholder="Twitter Consumer Key"
              containerClassName="col-span-1"
            />
            <FormInput
              control={form.control}
              name="consumerSecret"
              label="Twitter Consumer Secret"
              placeholder="Twitter Consumer Secret"
              containerClassName="col-span-1"
            />
            <ProviderRedirectUrlInput
              id="twitter-redirectUrl"
              value={`${generateAppServiceUrl(
                project!.subdomain,
                project!.region,
                'auth',
              )}/signin/provider/twitter/callback`}
              className="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
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
