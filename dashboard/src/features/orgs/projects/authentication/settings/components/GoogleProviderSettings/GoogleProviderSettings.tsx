import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import type { BaseProviderSettingsFormValues } from '@/features/orgs/projects/authentication/settings/components/BaseProviderSettings';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { copy } from '@/utils/copy';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import * as Yup from 'yup';

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
  const { maintenanceActive } = useUI();
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

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Google..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch, register } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: BaseProviderSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
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
        <SettingsContainer
          title="Google"
          description="Allow users to sign in with Google."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/social/sign-in-google"
          docsTitle="how to sign in users with Google"
          icon="/assets/brands/google.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-3 gap-x-3 gap-y-4 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register('clientId')}
            id="google-clientId"
            label="Client ID"
            placeholder="Enter your Client ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.clientId}
            helperText={formState.errors?.clientId?.message}
          />
          <Input
            {...register('clientSecret')}
            id="google-clientSecret"
            label="Client Secret"
            placeholder="Enter your Client Secret"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.clientSecret}
            helperText={formState.errors?.clientSecret?.message}
          />
          <Input
            {...register('audience')}
            name="audience"
            id="audience"
            label="Audience (optional)"
            placeholder="Enter Audience"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.audience}
            helperText={formState.errors?.audience?.message}
          />
          <Input
            name="redirectUrl"
            id="google-redirectUrl"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
            defaultValue={`${generateAppServiceUrl(
              project.subdomain,
              project.region,
              'auth',
            )}/signin/provider/google/callback`}
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
                        project.subdomain,
                        project.region,
                        'auth',
                      )}/signin/provider/google/callback`,
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
