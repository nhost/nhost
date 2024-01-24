import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import type { BaseProviderSettingsFormValues } from '@/features/authentication/settings/components/BaseProviderSettings';
import {
  BaseProviderSettings,
  baseProviderValidationSchema,
} from '@/features/authentication/settings/components/BaseProviderSettings';
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

export default function GitLabProviderSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { clientId, clientSecret, enabled } =
    data?.config?.auth?.method?.oauth?.gitlab || {};

  const form = useForm<BaseProviderSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(baseProviderValidationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for GitLab..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEnabled = watch('enabled');

  async function handleSubmit(values: BaseProviderSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            method: {
              oauth: {
                gitlab: {
                  ...values,
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
        form.reset(values);
      },
      {
        loadingMessage: 'GitLab settings are being updated...',
        successMessage: 'GitLab settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's GitLab settings.",
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="GitLab"
          description="Allow users to sign in with GitLab."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          icon="/assets/brands/gitlab.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-x-3 gap-y-4 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <BaseProviderSettings providerName="gitlab" />
          <Input
            name="redirectUrl"
            id="gitlab-redirectUrl"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
            defaultValue={`${generateAppServiceUrl(
              currentProject.subdomain,
              currentProject.region,
              'auth',
            )}/signin/provider/gitlab/callback`}
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
                      )}/signin/provider/gitlab/callback`,
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
