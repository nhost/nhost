import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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
  const { maintenanceActive } = useUI();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { enabledAPIs } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraEnabledAPIFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabledAPIs: enabledAPIs.map((api) => ({
        label: api,
        value: api,
      })),
    },
    resolver: yupResolver(validationSchema),
  });

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
        appId: currentProject.id,
        config: {
          hasura: {
            settings: {
              enabledAPIs: formValues.enabledAPIs.map((api) => api.value),
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Enabled APIs are being updated...`,
          success: `Enabled APIs have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update enabled APIs.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
      await refetchWorkspaceAndProject();
    } catch {
      // Note: The toast will handle the error.
    }
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
          className="grid grid-flow-row gap-y-2 gap-x-4 px-4 lg:grid-cols-6"
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
