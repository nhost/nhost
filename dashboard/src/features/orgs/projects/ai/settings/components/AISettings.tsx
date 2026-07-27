import { yupResolver } from '@hookform/resolvers/yup';
import { InfoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormFreeCombobox } from '@/components/form/FormFreeCombobox';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
} from '@/components/layout/SettingsCard';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DisableAIServiceConfirmationDialog } from '@/features/orgs/projects/ai/settings/components/DisableAIServiceConfirmationDialog';
import { isPostgresVersionValidForAI } from '@/features/orgs/projects/ai/settings/utils/isPostgresVersionValidForAI';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { COST_PER_VCPU } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { ComputeFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/ComputeFormSection';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  Software_Type_Enum,
  useGetAiSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';
import { getToastStyleProps } from '@/utils/constants/settings';

const validationSchema = Yup.object({
  version: Yup.string().required().label('AI Version'),
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

function InfoTooltip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export default function AISettings() {
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });
  const { project } = useProject();

  const [aiServiceEnabled, setAIServiceEnabled] = useState(true);

  const { data, error: errorGettingAiSettings } = useGetAiSettingsQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
    skip: !project?.id,
  });

  const ai = data?.config?.ai;
  const postgresVersion = data?.config?.postgres?.version;

  const { data: graphiteVersionsData, loading: loadingGraphiteVersionsData } =
    useGetSoftwareVersionsQuery({
      variables: {
        software: Software_Type_Enum.Graphite,
      },
      skip: !isPlatform,
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
      version: ai?.version || availableVersions?.at(0)?.value || '',
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

  const { formState, reset, watch, setValue } = form;

  const aiSettingsFormValues = watch();

  useEffect(() => {
    if (ai) {
      reset({
        version: ai!.version!,
        webhookSecret: ai?.webhookSecret,
        synchPeriodMinutes: ai?.autoEmbeddings?.synchPeriodMinutes,
        apiKey: ai?.openai?.apiKey,
        organization: ai!.openai!.organization!,
        compute: {
          cpu: ai?.resources?.compute?.cpu ?? 62,
          memory: ai?.resources?.compute?.memory ?? 128,
        },
      });
    }

    setAIServiceEnabled(!!ai);
  }, [ai, reset]);

  useEffect(() => {
    if (
      !loadingGraphiteVersionsData &&
      availableVersions.length > 0 &&
      !ai &&
      !aiSettingsFormValues.version
    ) {
      setValue('version', availableVersions.at(0)!.value);
    }
  }, [
    ai,
    setValue,
    availableVersions,
    aiSettingsFormValues,
    loadingGraphiteVersionsData,
  ]);

  const toggleAIService = async (enabled: boolean) => {
    if (
      isNotEmptyValue(postgresVersion) &&
      !isPostgresVersionValidForAI(postgresVersion)
    ) {
      toast.error(
        'In order to enable the AI service you need to update your database version to 14.6-20231018-1 or newer.',
        {
          style: getToastStyleProps().style,
          ...getToastStyleProps().error,
        },
      );
      return;
    }

    setAIServiceEnabled(enabled);

    if (!enabled && ai) {
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

  if (errorGettingAiSettings) {
    throw errorGettingAiSettings;
  }

  async function handleSubmit(formValues: AISettingsFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await updateConfig({
          variables: {
            appId: project?.id,
            config: {
              ai: {
                version: formValues.version,
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
        });

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
        loadingMessage: 'AI settings are being updated...',
        successMessage: 'AI settings has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the AI settings!',
      },
    );
  }

  const getAIResourcesCost = () => {
    const vCPUs = `${
      aiSettingsFormValues.compute.cpu / RESOURCE_VCPU_MULTIPLIER
    } vCPUs`;
    const mem = `${aiSettingsFormValues.compute.memory} MiB Mem`;
    const details = `${vCPUs} + ${mem}`;

    return `Approximate cost for ${details}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between rounded-lg border-1 p-4">
        <p className="font-semibold text-lg">Enable AI service</p>
        <Switch
          checked={aiServiceEnabled}
          onCheckedChange={toggleAIService}
          className="self-center"
          aria-label="Toggle AI service"
        />
      </div>
      {aiServiceEnabled && (
        <FormProvider {...form}>
          <Form onSubmit={handleSubmit}>
            <SettingsCard>
              <SettingsCardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-row items-center space-x-2">
                      <p className="font-semibold text-lg">Version</p>
                      <InfoTooltip>Version of the service to use.</InfoTooltip>
                    </div>
                    <FormFreeCombobox
                      name="version"
                      className="col-span-4"
                      options={availableVersions}
                      control={form.control}
                      placeholder="Select AI Version"
                      customValueLabel={(val) => `Use custom value: "${val}"`}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-row items-center space-x-2">
                      <p className="font-semibold text-lg">Webhook Secret</p>
                      <InfoTooltip>
                        Used to validate requests between postgres and the AI
                        service. The AI service will also include the header
                        X-Graphite-Webhook-Secret with this value set when
                        calling external webhooks so the source of the request
                        can be validated.
                      </InfoTooltip>
                    </div>
                    <FormInput
                      control={form.control}
                      name="webhookSecret"
                      placeholder="Webhook Secret"
                      containerClassName="col-span-3"
                      aria-label="Webhook Secret"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-row items-center space-x-2">
                      <p className="font-semibold text-lg">Resources</p>
                      <InfoTooltip>
                        Dedicated resources allocated for the service.
                      </InfoTooltip>
                    </div>

                    {isPlatform ? (
                      <Alert
                        variant="info"
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
                    ) : null}

                    <ComputeFormSection />
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-lg">OpenAI</p>

                    <FormInput
                      control={form.control}
                      name="apiKey"
                      placeholder="API Key"
                      label={
                        <div className="flex flex-row items-center space-x-2">
                          <span>OpenAI API key</span>
                          <InfoTooltip>
                            Key to use for authenticating API requests to OpenAI
                          </InfoTooltip>
                        </div>
                      }
                      containerClassName="col-span-3"
                    />

                    <FormInput
                      control={form.control}
                      name="organization"
                      label={
                        <div className="flex flex-row items-center space-x-2">
                          <span>OpenAI Organization</span>
                          <InfoTooltip>
                            Optional. OpenAI organization to use.
                          </InfoTooltip>
                        </div>
                      }
                      placeholder="Organization"
                      containerClassName="col-span-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-lg">Auto-Embeddings</p>
                    <FormField
                      control={form.control}
                      name="synchPeriodMinutes"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>
                            <div className="flex flex-row items-center space-x-2">
                              <span>Synch Period Minutes</span>
                              <InfoTooltip>
                                How often to run the job that keeps embeddings
                                up to date.
                              </InfoTooltip>
                            </div>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="Synch Period Minutes"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </SettingsCardContent>

              <SettingsCardFooter>
                <ButtonWithLoading
                  type="submit"
                  disabled={!formState.isDirty}
                  loading={formState.isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Save
                </ButtonWithLoading>
              </SettingsCardFooter>
            </SettingsCard>
          </Form>
        </FormProvider>
      )}
    </div>
  );
}
