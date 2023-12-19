import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { filterOptions } from '@/components/ui/v2/Autocomplete';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ComputeFormSection } from '@/features/services/components/ServiceForm/components/ComputeFormSection';
import {
  Software_Type_Enum,
  useGetAiSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

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
  const [updateConfig] = useUpdateConfigMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [aiServiceEnabled, setAiServiceEnabled] = useState(true);

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
        label: '0.1.0-beta4',
        value: '0.1.0-beta4',
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

  const { register, formState, reset } = form;

  useEffect(() => {
    if (ai) {
      reset({
        version: { label: ai?.version, value: ai?.version },
        webhookSecret: ai?.webhookSecret,
        synchPeriodMinutes: ai?.autoEmbeddings?.synchPeriodMinutes,
        apiKey: ai?.openai?.apiKey,

        compute: {
          cpu: ai?.resources?.compute?.cpu ?? 62,
          memory: ai?.resources?.compute?.memory ?? 128,
        },
      });
    }

    setAiServiceEnabled(!!ai);
  }, [ai, reset]);

  const disableAiSercice = useCallback(async () => {
    await updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          ai: null,
        },
      },
    });
  }, [updateConfig, currentProject.id]);

  useEffect(() => {
    (async () => {
      if (!aiServiceEnabled) {
        await disableAiSercice();
      }
    })();
  }, [aiServiceEnabled, disableAiSercice]);

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

  return (
    <Box className="space-y-4" sx={{ backgroundColor: 'background.default' }}>
      <Box className="flex flex-row items-center justify-between rounded-lg border-1 p-4">
        <Text className="text-lg font-semibold">Enable AI service</Text>
        <Switch
          checked={aiServiceEnabled}
          onChange={(e) => setAiServiceEnabled(e.target.checked)}
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
                  <Text className="text-lg font-semibold">Webhook Secret</Text>
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
                  <Text className="text-lg font-semibold">Resources</Text>
                  <ComputeFormSection />
                </Box>

                <Box className="space-y-2">
                  <Text className="text-lg font-semibold">OpenAI</Text>

                  <Input
                    {...register('organization')}
                    id="organization"
                    name="organization"
                    placeholder="Organization"
                    className="col-span-3"
                    fullWidth
                    hideEmptyHelperText
                    error={Boolean(formState.errors.organization?.message)}
                    helperText={formState.errors.organization?.message}
                  />

                  <Input
                    {...register('apiKey')}
                    name="apiKey"
                    placeholder="Api Key"
                    id="apiKey"
                    className="col-span-3"
                    fullWidth
                    hideEmptyHelperText
                    error={Boolean(formState.errors.apiKey?.message)}
                    helperText={formState.errors.apiKey?.message}
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
