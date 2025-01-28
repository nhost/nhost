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
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTheme } from '@mui/material';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

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
  enabled: Yup.boolean(),
});

export type AppleProviderFormValues = Yup.InferType<typeof validationSchema>;

export default function AppleProviderSettings() {
  const theme = useTheme();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { clientId, enabled, keyId, privateKey, teamId } =
    data?.config?.auth?.method?.oauth?.apple || {};

  const form = useForm<AppleProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      teamId: teamId || '',
      keyId: keyId || '',
      clientId: clientId || '',
      privateKey: privateKey || '',
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
        enabled: enabled || false,
      });
    }
  }, [loading, teamId, keyId, clientId, privateKey, enabled, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Apple..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: AppleProviderFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
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
        <SettingsContainer
          title="Apple"
          description="Allow users to sign in with Apple."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/social/sign-in-apple"
          docsTitle="how to sign in users with Apple"
          icon={
            theme.palette.mode === 'dark'
              ? '/assets/brands/light/apple.svg'
              : '/assets/brands/apple.svg'
          }
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-x-3 gap-y-4 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register('teamId')}
            name="teamId"
            id="teamId"
            label="Team ID"
            placeholder="Apple Team ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.teamId}
            helperText={formState.errors?.teamId?.message}
          />
          <Input
            {...register('clientId')}
            name="clientId"
            id="clientId"
            label="Service ID"
            placeholder="Apple Service ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.clientId}
            helperText={formState.errors?.clientId?.message}
          />
          <Input
            {...register('keyId')}
            name="keyId"
            id="keyId"
            label="Key ID"
            placeholder="Apple Key ID"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.keyId}
            helperText={formState.errors?.keyId?.message}
          />
          <Input
            {...register('privateKey')}
            multiline
            rows={4}
            name="privateKey"
            id="privateKey"
            label="Private Key"
            placeholder="Paste Private Key here"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.privateKey}
            helperText={formState.errors?.privateKey?.message}
          />
          <Input
            name="redirectUrl"
            id="apple-redirectUrl"
            defaultValue={`${generateAppServiceUrl(
              currentProject.subdomain,
              currentProject.region,
              'auth',
            )}/signin/provider/apple/callback`}
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
                        currentProject.subdomain,
                        currentProject.region,
                        'auth',
                      )}/signin/provider/apple/callback`,
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
