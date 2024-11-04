import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  corsDomain: Yup.string()
    .label('Allowed CORS domains')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
});

export type HasuraCorsDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraCorsDomainSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { corsDomain } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraCorsDomainFormValues>({
    reValidateMode: 'onSubmit',
    values: {
      enabled:
        corsDomain && corsDomain.length === 1
          ? corsDomain[0] !== '*'
          : !!corsDomain?.length,
      corsDomain:
        corsDomain && corsDomain.length === 1 && corsDomain[0] !== '*'
          ? corsDomain[0]
          : corsDomain?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, watch } = form;
  const enabled = watch('enabled');
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading CORS domain settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraCorsDomainFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          hasura: {
            settings: {
              corsDomain: formValues.enabled
                ? formValues.corsDomain
                    .split(',')
                    .map((domain) => domain.trim())
                : ['*'],
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage: 'CORS domain settings are being updated...',
        successMessage: 'CORS domain settings have been updated successfully.',
        errorMessage: `An error occurred while trying to update the project's CORS domain settings.`,
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Configure CORS"
          description="Allow requests from specific domains to access your GraphQL API. Disable this setting to allow requests from all domains."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          switchId="enabled"
          showSwitch
          docsTitle="CORS configuration"
          docsLink="https://hasura.io/docs/latest/deployment/graphql-engine-flags/config-examples/#configure-cors"
          className={twMerge(
            'grid grid-cols-5 gap-4 px-4',
            !enabled && 'hidden',
          )}
        >
          <Input
            {...register('corsDomain')}
            label="Allowed CORS domains"
            placeholder="https://example.com, https://*.example.com"
            id="corsDomain"
            fullWidth
            className="col-span-5 lg:col-span-2"
            error={Boolean(formState.errors.corsDomain)}
            aria-hidden={!enabled}
            helperText={formState.errors.corsDomain?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
