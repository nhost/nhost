import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabledAPIs: Yup.array(
    Yup.object({
      label: Yup.string().required(),
      value: Yup.string().required(),
    }),
  )
    .label('Enabled Hasura APIs')
    .required(),
});

export type HasuraEnabledAPIFormValues = Yup.InferType<typeof validationSchema>;

const AVAILABLE_HASURA_APIS = ['metadata', 'graphql', 'pgdump', 'config'];

export default function HasuraEnabledAPISettings() {
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

  const { enabledAPIs = [] } = data?.config?.hasura?.settings || {};

  const form = useForm<HasuraEnabledAPIFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabledAPIs: [],
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (enabledAPIs && !loading) {
      form.reset({
        enabledAPIs: enabledAPIs.map((api) => ({ label: api, value: api })),
      });
    }
  }, [form, enabledAPIs, loading]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading enabled APIs..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const availableAPIs = AVAILABLE_HASURA_APIS.map((api) => ({
    label: api,
    value: api,
  }));

  async function handleSubmit(formValues: HasuraEnabledAPIFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          hasura: {
            settings: {
              enabledAPIs: formValues.enabledAPIs.map((api) => api.value),
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
        loadingMessage: 'Enabled APIs are being updated...',
        successMessage: 'Enabled APIs have been updated successfully.',
        errorMessage: 'An error occurred while trying to update enabled APIs.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Enabled APIs"
          description="Enable or disable APIs for your Hasura instance."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-6"
        >
          <ControlledAutocomplete
            id="enabledAPIs"
            name="enabledAPIs"
            fullWidth
            multiple
            className="lg:col-span-3"
            aria-label="Enabled APIs"
            options={availableAPIs}
            error={!!formState.errors?.enabledAPIs?.message}
            helperText={formState.errors?.enabledAPIs?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
