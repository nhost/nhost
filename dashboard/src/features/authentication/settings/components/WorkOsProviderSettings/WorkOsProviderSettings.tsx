import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { BaseProviderSettings } from '@/features/authentication/settings/components/BaseProviderSettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
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
  organization: Yup.string()
    .label('Organization')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  connection: Yup.string()
    .label('Connection')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  enabled: Yup.boolean(),
});

export type WorkOsProviderFormValues = Yup.InferType<typeof validationSchema>;

export default function WorkOsProviderSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { clientId, clientSecret, organization, connection, enabled } =
    data?.config?.auth?.method?.oauth?.workos || {};

  const form = useForm<WorkOsProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      organization: organization || '',
      connection: connection || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for WorkOS..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(formValues: WorkOsProviderFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            method: {
              oauth: {
                workos: formValues,
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
      },
      {
        loadingMessage: 'WorkOS settings are being updated...',
        successMessage: 'WorkOS settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's WorkOS settings.",
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="WorkOS"
          description="Allow users to sign in with WorkOS."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-workos"
          docsTitle="how to sign in users with WorkOS"
          icon="/assets/brands/workos.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid grid-flow-row grid-cols-2 gap-x-3 gap-y-4 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <BaseProviderSettings providerName="workos" />
          <Input
            {...register('organization')}
            name="organization"
            id="organization"
            label="Default Organization ID (optional)"
            placeholder="Default Organization ID"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.organization}
            helperText={formState.errors?.organization?.message}
          />
          <Input
            {...register('connection')}
            name="connection"
            id="connection"
            label="Default Connection (optional)"
            placeholder="Default Connection"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.connection}
            helperText={formState.errors?.connection?.message}
          />
          <Input
            name="redirectUrl"
            id="workos-redirectUrl"
            defaultValue={`${generateAppServiceUrl(
              currentProject.subdomain,
              currentProject.region,
              'auth',
            )}/signin/provider/workos/callback`}
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
                      )}/signin/provider/workos/callback`,
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
