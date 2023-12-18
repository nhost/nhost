import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { filterOptions } from '@/components/ui/v2/Autocomplete';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ComputeFormSection } from '@/features/services/components/ServiceForm/components/ComputeFormSection';
import {
  useGetAiSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface AISettingsFormValues {
  /**
   * The git branch to deploy from.
   */
  version: {
    label: string;
    value: string;
  };
  webhookSecret: string;
  synchPeriodMinutes: number;
  apiKey: string;
  compute: {
    cpu: 62;
    memory: 128;
  };
}

export default function AISettings() {
  const { maintenanceActive } = useUI();
  const [updateConfig] = useUpdateConfigMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data: { config: { ai } = {} } = {} } = useGetAiSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
  });

  const form = useForm<AISettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      version: null,
      webhookSecret: '',
      synchPeriodMinutes: 5,
      apiKey: '',
      compute: {
        cpu: 62,
        memory: 128,
      },
    },
  });

  const { register, formState, reset, setValue } = form;

  useEffect(() => {
    reset({
      version: ai?.version
        ? {
            label: ai?.version,
            value: ai?.version,
          }
        : null,
      webhookSecret: ai?.webhookSecret ?? '',
      synchPeriodMinutes: ai?.autoEmbeddings?.synchPeriodMinutes ?? 5,
      apiKey: ai?.openai?.apiKey ?? '',
      compute: {
        cpu: ai?.resources?.compute?.cpu ?? 62,
        memory: ai?.resources?.compute?.memory || 128,
      },
    });
  }, [ai, reset]);

  async function handleSubmit(formValues: AISettingsFormValues) {
    try {
      await toast.promise(
        updateConfig({
          variables: {
            appId: currentProject.id,
            config: {
              ai: {
                version: formValues.version.value,
                webhookSecret: formValues.webhookSecret,
                autoEmbeddings: {
                  synchPeriodMinutes: Number(formValues.synchPeriodMinutes),
                },
                openai: {
                  apiKey: formValues.apiKey,
                },
                resources: {
                  compute: {
                    cpu: formValues.compute.cpu,
                    memory: formValues.compute.memory,
                  },
                },
              },
            },
          },
        }),
        {
          loading: `AI settings are being updated...`,
          success: `AI settings has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the AI settings!`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
    } catch {
      // Note: The toast will handle the error.
    }
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title={null}
          description={null}
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="flex flex-col"
        >
          <Box className="space-y-4">
            <Box className="space-y-2">
              <Text className="text-lg font-semibold">Version</Text>
              <ControlledAutocomplete
                id="version"
                name="version"
                filterOptions={(options, state) => {
                  if (state.inputValue === ai?.version) {
                    return options;
                  }
                  return filterOptions(options, state);
                }}
                fullWidth
                className="lg:col-span-2"
                options={[
                  {
                    label: '0.1.0-beta4',
                    value: '0.1.0-beta4',
                  },
                ]}
                error={!!formState.errors?.version?.message}
                helperText={formState.errors?.version?.message}
                showCustomOption="auto"
                customOptionLabel={(value) => `Use custom value: "${value}"`}
              />
            </Box>

            <Box className="space-y-2">
              <Text className="text-lg font-semibold">Webhook Secret</Text>
              <Input
                {...register('webhookSecret')}
                name="wehookSecret"
                placeholder="Webhook Secret"
                id="webhookSecret"
                className="col-span-3"
                fullWidth
                hideEmptyHelperText
              />
            </Box>

            <Box className="space-y-2">
              <Text className="text-lg font-semibold">
                Synch Period Minutes
              </Text>
              <Input
                {...register('synchPeriodMinutes')}
                id="synchPeriodMinutes"
                name="synchPeriodMinutes"
                type="number"
                fullWidth
                className="lg:col-span-2"
                error={Boolean(formState.errors.synchPeriodMinutes?.message)}
                helperText={formState.errors.synchPeriodMinutes?.message}
                slotProps={{
                  inputRoot: {
                    min: 0,
                  },
                }}
              />
            </Box>

            <Box className="space-y-2">
              <Text className="text-lg font-semibold">OpenAI Api Key</Text>

              <Input
                {...register('apiKey')}
                name="apiKey"
                placeholder="Api Key"
                id="apiKey"
                className="col-span-3"
                fullWidth
                hideEmptyHelperText
              />
            </Box>

            <Box className="space-y-2">
              <Text className="text-lg font-semibold">Resources</Text>
              <ComputeFormSection />
            </Box>
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
