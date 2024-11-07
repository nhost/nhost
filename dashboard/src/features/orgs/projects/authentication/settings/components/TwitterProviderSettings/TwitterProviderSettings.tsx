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
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { copy } from '@/utils/copy';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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
  const { maintenanceActive } = useUI();
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

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Twitter..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: TwitterProviderFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
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
        <SettingsContainer
          title="Twitter"
          description="Allow users to sign in with Twitter."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsTitle="how to sign in users with Twitter"
          icon="/assets/brands/twitter.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-x-3 gap-y-4 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register(`consumerKey`)}
            name="consumerKey"
            id="consumerKey"
            label="Twitter Consumer Key"
            placeholder="Twitter Consumer Key"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.consumerKey}
            helperText={formState.errors?.consumerKey?.message}
          />
          <Input
            {...register('consumerSecret')}
            name="consumerSecret"
            id="consumerSecret"
            label="Twitter Consumer Secret"
            placeholder="Twitter Consumer Secret"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.consumerSecret}
            helperText={formState.errors?.consumerSecret?.message}
          />
          <Input
            name="redirectUrl"
            id="twitter-redirectUrl"
            defaultValue={`${generateAppServiceUrl(
              project.subdomain,
              project.region,
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
                        project.subdomain,
                        project.region,
                        'auth',
                      )}/signin/provider/twitter/callback`,
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
