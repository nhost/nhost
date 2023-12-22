import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { filterOptions } from '@/components/ui/v2/Autocomplete';
import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { COST_PER_VCPU } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { ComputeFormSection } from '@/features/services/components/ServiceForm/components/ComputeFormSection';
import {
  Software_Type_Enum,
  useGetAiSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';
import { DisableAIServiceConfirmationDialog } from './DisableAIServiceConfirmationDialog';

const validationSchema = Yup.object({
  version: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  }),
  webhookSecret: Yup.string(),
  synchPeriodMinutes: Yup.number(),
  organization: Yup.string(),
  apiKey: Yup.string().required(),
  compute: Yup.object({
    cpu: Yup.number().required(),
    memory: Yup.number().required(),
  }),
});

export type AISettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function AISettings() {
  const { maintenanceActive } = useUI();
  const { openDialog } = useDialog();
  const [updateConfig] = useUpdateConfigMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [aiServiceEnabled, setAIServiceEnabled] = useState(true);

  const {
    data: { config: { ai } = {} } = {},
    loading: loadingAiSettings,
    error: errorGettingAiSettings,
  } = useGetAiSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
  });

  const { data: graphiteVersionsData, loading: loadingGraphiteVersionsData } =
    useGetSoftwareVersionsQuery({
      variables: {
        software: Software_Type_Enum.Graphite,
      },
    });

  const graphiteVersions = graphiteVersionsData?.softwareVersions || [];

  const availableVersionsSet = new Set(
    graphiteVersions.map((el) => el.version),
  );

  if (ai?.version) {
    availableVersionsSet.add(ai.version);
  }

  const availableVersions = Array.from(availableVersionsSet)
    .sort()
    .reverse()
    .map((availableVersion) => ({
      label: availableVersion,
      value: availableVersion,
    }));

  const form = useForm<AISettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      version: {
        label: '0.1.0',
        value: '0.1.0',
      },
      webhookSecret: '',
      organization: '',
      apiKey: '',
      synchPeriodMinutes: 5,
      compute: {
        cpu: 125,
        memory: 256,
      },
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, reset, watch } = form;

  useEffect(() => {
    if (ai) {
      reset({
        version: { label: ai?.version, value: ai?.version },
        webhookSecret: ai?.webhookSecret,
        synchPeriodMinutes: ai?.autoEmbeddings?.synchPeriodMinutes,
        apiKey: ai?.openai?.apiKey,
        organization: ai?.openai?.organization,
        compute: {
          cpu: ai?.resources?.compute?.cpu ?? 62,
          memory: ai?.resources?.compute?.memory ?? 128,
        },
      });
    }

    setAIServiceEnabled(!!ai);
  }, [ai, reset]);

  const toggleAIService = async (enabled: boolean) => {
    setAIServiceEnabled(enabled);

    if (!enabled) {
      openDialog({
        title: 'Confirm Disabling the AI service',
        component: (
          <DisableAIServiceConfirmationDialog
            onCancel={() => setAIServiceEnabled(true)}
            onServiceDisabled={() => setAIServiceEnabled(false)}
          />
        ),
      });
    }
  };

  if (loadingAiSettings || loadingGraphiteVersionsData) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Postgres version..."
        className="justify-center"
      />
    );
  }

  if (errorGettingAiSettings) {
    throw errorGettingAiSettings;
  }

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
                  organization: formValues.organization,
                },
                resources: {
                  compute: {
                    cpu: formValues?.compute?.cpu,
                    memory: formValues?.compute?.memory,
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

  const aiSettingsFormValues = watch();

  const getAIResourcesCost = () => {
    const vCPUs = `${
      aiSettingsFormValues.compute.cpu / RESOURCE_VCPU_MULTIPLIER
    } vCPUs`;
    const mem = `${aiSettingsFormValues.compute.memory} MiB Mem`;
    const details = `${vCPUs} + ${mem}`;

    return `Approximate cost for ${details}`;
  };

  return (
    <Box className="space-y-4" sx={{ backgroundColor: 'background.default' }}>
      <Box className="flex flex-row items-center justify-between rounded-lg border-1 p-4">
        <Text className="text-lg font-semibold">Enable AI service</Text>
        <Switch
          checked={aiServiceEnabled}
          onChange={(e) => toggleAIService(e.target.checked)}
          className="self-center"
        />
      </Box>
      {aiServiceEnabled && (
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
                  <Box className="flex flex-row items-center space-x-2">
                    <Text className="text-lg font-semibold">Version</Text>
                    <Tooltip title="Version of the service to use.">
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4"
                        color="primary"
                      />
                    </Tooltip>
                  </Box>
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
                    className="col-span-4"
                    options={availableVersions}
                    error={!!formState.errors?.version?.message}
                    helperText={formState.errors?.version?.message}
                    showCustomOption="auto"
                    customOptionLabel={(value) =>
                      `Use custom value: "${value}"`
                    }
                  />
                </Box>

                <Box className="space-y-2">
                  <Box className="flex flex-row items-center space-x-2">
                    <Text className="text-lg font-semibold">
                      Webhook Secret
                    </Text>
                    <Tooltip title="Used to validate requests between postgres and the AI service. The AI service will also include the header X-Graphite-Webhook-Secret with this value set when calling external webhooks so the source of the request can be validated.">
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4"
                        color="primary"
                      />
                    </Tooltip>
                  </Box>
                  <Input
                    {...register('webhookSecret')}
                    id="webhookSecret"
                    name="webhookSecret"
                    placeholder="Webhook Secret"
                    className="col-span-3"
                    fullWidth
                    hideEmptyHelperText
                    error={Boolean(formState.errors.webhookSecret?.message)}
                    helperText={formState.errors.webhookSecret?.message}
                  />
                </Box>

                <Box className="space-y-2">
                  <Box className="flex flex-row items-center space-x-2">
                    <Text className="text-lg font-semibold">Resources</Text>
                    <Tooltip title="Dedicated resources allocated for the service.">
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4"
                        color="primary"
                      />
                    </Tooltip>
                  </Box>

                  <Alert
                    severity="info"
                    className="flex items-center justify-between space-x-2"
                  >
                    <span>{getAIResourcesCost()}</span>
                    <b>
                      $
                      {parseFloat(
                        (
                          aiSettingsFormValues.compute.cpu * COST_PER_VCPU
                        ).toFixed(2),
                      )}
                    </b>
                  </Alert>

                  <ComputeFormSection />
                </Box>

                <Box className="space-y-2">
                  <Text className="text-lg font-semibold">OpenAI</Text>

                  <Input
                    {...register('apiKey')}
                    name="apiKey"
                    placeholder="API Key"
                    id="apiKey"
                    label={
                      <Box className="flex flex-row items-center space-x-2">
                        <Text>OpenAI API key</Text>
                        <Tooltip title="Key to use for authenticating API requests to OpenAI">
                          <InfoIcon
                            aria-label="Info"
                            className="h-4 w-4"
                            color="primary"
                          />
                        </Tooltip>
                      </Box>
                    }
                    className="col-span-3"
                    fullWidth
                    hideEmptyHelperText
                    error={Boolean(formState.errors.apiKey?.message)}
                    helperText={formState.errors.apiKey?.message}
                  />

                  <Input
                    {...register('organization')}
                    id="organization"
                    name="organization"
                    label={
                      <Box className="flex flex-row items-center space-x-2">
                        <Text>OpenAI Organization</Text>
                        <Tooltip title="Optional. OpenAI organization to use.">
                          <InfoIcon
                            aria-label="Info"
                            className="h-4 w-4"
                            color="primary"
                          />
                        </Tooltip>
                      </Box>
                    }
                    placeholder="Organization"
                    className="col-span-3"
                    fullWidth
                    hideEmptyHelperText
                    error={Boolean(formState.errors.organization?.message)}
                    helperText={formState.errors.organization?.message}
                  />
                </Box>

                <Box className="space-y-2">
                  <Text className="text-lg font-semibold">Auto-Embeddings</Text>
                  <Input
                    {...register('synchPeriodMinutes')}
                    id="synchPeriodMinutes"
                    name="synchPeriodMinutes"
                    type="number"
                    label={
                      <Box className="flex flex-row items-center space-x-2">
                        <Text>Synch Period Minutes</Text>
                        <Tooltip title="How often to run the job that keeps embeddings up to date.">
                          <InfoIcon
                            aria-label="Info"
                            className="h-4 w-4"
                            color="primary"
                          />
                        </Tooltip>
                      </Box>
                    }
                    placeholder="Synch Period Minutes"
                    fullWidth
                    className="lg:col-span-2"
                    error={Boolean(
                      formState.errors.synchPeriodMinutes?.message,
                    )}
                    helperText={formState.errors.synchPeriodMinutes?.message}
                    slotProps={{
                      inputRoot: {
                        min: 0,
                      },
                    }}
                  />
                </Box>
              </Box>
            </SettingsContainer>
          </Form>
        </FormProvider>
      )}
    </Box>
  );
}
