/** biome-ignore-all lint/suspicious/noThenProperty: yup thing */

import { yupResolver } from '@hookform/resolvers/yup';
import { useTheme } from '@mui/material';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
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
  teamId: Yup.string()
    .label('Team ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  keyId: Yup.string()
    .label('Key ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  clientId: Yup.string()
    .label('Client ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  privateKey: Yup.string()
    .label('Private Key')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  audience: Yup.string().label('Audience'),
  enabled: Yup.boolean(),
});

export type AppleProviderFormValues = Yup.InferType<typeof validationSchema>;

export default function AppleProviderSettings() {
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

  const { clientId, enabled, keyId, privateKey, teamId, audience } =
    data?.config?.auth?.method?.oauth?.apple || {};

  const form = useForm<AppleProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      teamId: teamId || '',
      keyId: keyId || '',
      clientId: clientId || '',
      privateKey: privateKey || '',
      audience: audience || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        teamId: teamId || '',
        keyId: keyId || '',
        clientId: clientId || '',
        privateKey: privateKey || '',
        audience: audience || '',
        enabled: enabled || false,
      });
    }
  }, [loading, teamId, keyId, clientId, privateKey, audience, enabled, form]);

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: AppleProviderFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            method: {
              oauth: {
                apple: {
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
        loadingMessage: 'Apple settings are being updated...',
        successMessage: 'Apple settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Apple settings.",
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Apple"
            description="Allow users to sign in with Apple."
            icon={
              theme.palette.mode === 'dark'
                ? '/assets/brands/light/apple.svg'
                : '/assets/brands/apple.svg'
            }
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Apple"
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
              name="teamId"
              label="Team ID"
              placeholder="Apple Team ID"
              containerClassName="col-span-1"
            />
            <FormInput
              control={form.control}
              name="clientId"
              label="Service ID"
              placeholder="Apple Service ID"
              containerClassName="col-span-1"
            />
            <FormInput
              control={form.control}
              name="keyId"
              label="Key ID"
              placeholder="Apple Key ID"
              containerClassName="col-span-2"
            />
            <div className="col-span-2">
              <FormTextarea
                control={form.control}
                name="privateKey"
                label="Private Key"
                placeholder="Paste Private Key here"
              />
            </div>
            <FormInput
              control={form.control}
              name="audience"
              label="Audience, set it to enable idtokens (optional)"
              placeholder="AppleAudience1,AppleAudience2"
              containerClassName="col-span-2"
            />
            <ProviderRedirectUrlInput
              id="apple-redirectUrl"
              value={`${generateAppServiceUrl(
                project!.subdomain,
                project!.region,
                'auth',
              )}/signin/provider/apple/callback`}
              className="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/providers/sign-in-apple"
              title="how to sign in users with Apple"
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
