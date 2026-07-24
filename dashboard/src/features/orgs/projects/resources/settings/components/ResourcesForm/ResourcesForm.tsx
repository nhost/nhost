import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProPlan } from '@/features/orgs/projects/common/hooks/useProPlan';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CostEstimate } from '@/features/orgs/projects/resources/settings/components/CostEstimate';
import { CostSummary } from '@/features/orgs/projects/resources/settings/components/CostSummary';
import { PresetSelector } from '@/features/orgs/projects/resources/settings/components/PresetSelector';
import { RatioBanner } from '@/features/orgs/projects/resources/settings/components/RatioBanner';
import { ResourceBreakdownChart } from '@/features/orgs/projects/resources/settings/components/ResourceBreakdownChart';
import { ResourcesConfirmationDialog } from '@/features/orgs/projects/resources/settings/components/ResourcesConfirmationDialog';
import { ServiceRow } from '@/features/orgs/projects/resources/settings/components/ServiceRow';
import { calculateBillableResources } from '@/features/orgs/projects/resources/settings/utils/calculateBillableResources';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
import { applyPresetToForm } from '@/features/orgs/projects/resources/settings/utils/presets';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  ConfigConfigUpdateInput,
  GetResourcesQuery,
} from '@/generated/graphql';
import {
  useGetResourcesQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/constants/common';
import { removeTypename } from '@/utils/helpers';
import ResourcesFormFooter from './ResourcesFormFooter';

type ConfigKeys = Exclude<
  keyof NonNullable<GetResourcesQuery['config']>,
  '__typename'
>;

const DEFAULT_VALUES: ResourceSettingsFormValues = {
  enabled: false,
  database: {
    vcpu: 1000,
    memory: computeMemoryFromCPU(1000),
    lockRatio: true,
  },
  hasura: {
    vcpu: 500,
    memory: computeMemoryFromCPU(500),
    replicas: 1,
    autoscale: false,
    maxReplicas: 10,
    lockRatio: true,
  },
  auth: {
    vcpu: 250,
    memory: computeMemoryFromCPU(250),
    replicas: 1,
    autoscale: false,
    maxReplicas: 10,
    lockRatio: true,
  },
  storage: {
    vcpu: 250,
    memory: computeMemoryFromCPU(250),
    replicas: 1,
    autoscale: false,
    maxReplicas: 10,
    lockRatio: true,
  },
};

function getInitialServiceResources(
  service: ConfigKeys,
  data?: GetResourcesQuery,
) {
  if (service === 'postgres') {
    const { compute: computeConfig, ...restConfig } =
      data?.config?.[service]?.resources || {};
    return {
      vcpu: computeConfig?.cpu || 0,
      memory: computeConfig?.memory || 0,
      rest: restConfig,
    };
  }
  const { compute, autoscaler, replicas, ...rest } =
    data?.config?.[service]?.resources || {};
  return {
    replicas,
    vcpu: compute?.cpu || 0,
    memory: compute?.memory || 0,
    autoscale: autoscaler || null,
    rest,
  };
}

export default function ResourcesForm() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, closeDialog } = useDialog();

  const {
    data,
    loading,
    error: resourcesError,
  } = useGetResourcesQuery({
    variables: {
      appId: project?.id,
    },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    data: proPlan,
    loading: proPlanLoading,
    error: proPlanError,
  } = useProPlan();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const initialDatabaseResources = getInitialServiceResources('postgres', data);
  const initialHasuraResources = getInitialServiceResources('hasura', data);
  const initialAuthResources = getInitialServiceResources('auth', data);
  const initialStorageResources = getInitialServiceResources('storage', data);

  const totalInitialVcpu =
    initialDatabaseResources.vcpu +
    initialHasuraResources.vcpu +
    initialAuthResources.vcpu +
    initialStorageResources.vcpu;

  const totalInitialMemory =
    initialDatabaseResources.memory +
    initialHasuraResources.memory +
    initialAuthResources.memory +
    initialStorageResources.memory;

  const hasInitialValues = totalInitialVcpu > 0 && totalInitialMemory > 0;

  const detectInitialLock = (vcpu: number, memory: number) =>
    !hasInitialValues || memory === computeMemoryFromCPU(vcpu);

  const form = useForm<ResourceSettingsFormValues>({
    values: {
      enabled: hasInitialValues,
      database: {
        vcpu: initialDatabaseResources.vcpu || DEFAULT_VALUES.database.vcpu,
        memory:
          initialDatabaseResources.memory || DEFAULT_VALUES.database.memory,
        lockRatio: detectInitialLock(
          initialDatabaseResources.vcpu,
          initialDatabaseResources.memory,
        ),
      },
      hasura: {
        replicas:
          initialHasuraResources.replicas || DEFAULT_VALUES.hasura.replicas,
        vcpu: initialHasuraResources.vcpu || DEFAULT_VALUES.hasura.vcpu,
        memory: initialHasuraResources.memory || DEFAULT_VALUES.hasura.memory,
        autoscale: !!initialHasuraResources.autoscale,
        maxReplicas:
          initialHasuraResources.autoscale?.maxReplicas ||
          DEFAULT_VALUES.hasura.maxReplicas,
        lockRatio: detectInitialLock(
          initialHasuraResources.vcpu,
          initialHasuraResources.memory,
        ),
      },
      auth: {
        replicas: initialAuthResources.replicas || DEFAULT_VALUES.auth.replicas,
        vcpu: initialAuthResources.vcpu || DEFAULT_VALUES.auth.vcpu,
        memory: initialAuthResources.memory || DEFAULT_VALUES.auth.memory,
        autoscale: !!initialAuthResources.autoscale,
        maxReplicas:
          initialAuthResources.autoscale?.maxReplicas ||
          DEFAULT_VALUES.auth.maxReplicas,
        lockRatio: detectInitialLock(
          initialAuthResources.vcpu,
          initialAuthResources.memory,
        ),
      },
      storage: {
        replicas:
          initialStorageResources.replicas || DEFAULT_VALUES.storage.replicas,
        vcpu: initialStorageResources.vcpu || DEFAULT_VALUES.storage.vcpu,
        memory: initialStorageResources.memory || DEFAULT_VALUES.storage.memory,
        autoscale: !!initialStorageResources.autoscale,
        maxReplicas:
          initialStorageResources.autoscale?.maxReplicas ||
          DEFAULT_VALUES.storage.maxReplicas,
        lockRatio: detectInitialLock(
          initialStorageResources.vcpu,
          initialStorageResources.memory,
        ),
      },
    },
    resolver: yupResolver(resourceSettingsValidationSchema),
  });

  if (isPlatform && !proPlan && !proPlanLoading) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load the plan for this project. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (isPlatform && (loading || proPlanLoading)) {
    return (
      <Spinner size="small" className="mx-auto">
        <span className="mt-2 text-muted-foreground text-sm">
          Loading resource settings...
        </span>
      </Spinner>
    );
  }

  if (resourcesError || proPlanError) {
    throw resourcesError || proPlanError;
  }

  const billableResources = calculateBillableResources(
    { replicas: 1, vcpu: initialDatabaseResources.vcpu },
    {
      replicas: initialHasuraResources.replicas,
      vcpu: initialHasuraResources.vcpu,
    },
    {
      replicas: initialAuthResources.replicas,
      vcpu: initialAuthResources.vcpu,
    },
    {
      replicas: initialStorageResources.replicas,
      vcpu: initialStorageResources.vcpu,
    },
  );

  const initialPrice = isPlatform
    ? (billableResources.vcpu / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE
    : 0;

  const getFormattedConfig = (
    values: ResourceSettingsFormValues,
  ): ConfigConfigUpdateInput => {
    const sanitizedValues = removeTypename(
      values,
    ) as ResourceSettingsFormValues;

    const sanitizedInitialDatabaseResources = removeTypename(
      initialDatabaseResources,
    );
    const sanitizedInitialHasuraResources = removeTypename(
      initialHasuraResources,
    );
    const sanitizedInitialAuthResources = removeTypename(initialAuthResources);
    const sanitizedInitialStorageResources = removeTypename(
      initialStorageResources,
    );

    if (sanitizedValues.enabled) {
      return {
        postgres: {
          resources: {
            compute: {
              cpu: sanitizedValues.database.vcpu,
              memory: sanitizedValues.database.memory,
            },
            ...sanitizedInitialDatabaseResources.rest,
          },
        },
        hasura: {
          resources: {
            compute: {
              cpu: sanitizedValues.hasura.vcpu,
              memory: sanitizedValues.hasura.memory,
            },
            replicas: sanitizedValues.hasura.replicas,
            autoscaler: sanitizedValues.hasura.autoscale
              ? { maxReplicas: sanitizedValues.hasura.maxReplicas }
              : null,
            ...sanitizedInitialHasuraResources.rest,
          },
        },
        auth: {
          resources: {
            compute: {
              cpu: sanitizedValues.auth.vcpu,
              memory: sanitizedValues.auth.memory,
            },
            replicas: sanitizedValues.auth.replicas,
            autoscaler: sanitizedValues.auth.autoscale
              ? { maxReplicas: sanitizedValues.auth.maxReplicas }
              : null,
            ...sanitizedInitialAuthResources.rest,
          },
        },
        storage: {
          resources: {
            compute: {
              cpu: sanitizedValues.storage.vcpu,
              memory: sanitizedValues.storage.memory,
            },
            replicas: sanitizedValues.storage.replicas,
            autoscaler: sanitizedValues.storage.autoscale
              ? { maxReplicas: sanitizedValues.storage.maxReplicas }
              : null,
            ...sanitizedInitialStorageResources.rest,
          },
        },
      };
    }

    return {
      postgres: {
        resources: {
          compute: null,
          ...sanitizedInitialDatabaseResources.rest,
        },
      },
      hasura: {
        resources: {
          compute: null,
          replicas: null,
          autoscaler: null,
          ...sanitizedInitialHasuraResources.rest,
        },
      },
      auth: {
        resources: {
          compute: null,
          replicas: null,
          autoscaler: null,
          ...sanitizedInitialAuthResources.rest,
        },
      },
      storage: {
        resources: {
          compute: null,
          replicas: null,
          autoscaler: null,
          ...sanitizedInitialStorageResources.rest,
        },
      },
    };
  };

  async function handleSubmit(formValues: ResourceSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: getFormattedConfig(formValues),
      },
    });

    try {
      await execPromiseWithErrorToast(
        async () => {
          await updateConfigPromise;
          form.reset({ ...formValues });

          if (!isPlatform) {
            openDialog({
              title: 'Apply your changes',
              component: <ApplyLocalSettingsDialog />,
              props: {
                PaperProps: { className: 'max-w-2xl' },
              },
            });
          }
        },
        {
          loadingMessage: 'Updating resources...',
          successMessage: 'Resources have been updated successfully.',
          errorMessage:
            'An error occurred while updating resources. Please try again.',
        },
      );

      if (!formValues.enabled) {
        form.reset(DEFAULT_VALUES);
        applyPresetToForm(form.setValue, form.trigger, 'standard', {
          shouldDirty: false,
        });
        form.reset(form.getValues());
      } else {
        form.reset(undefined, { keepValues: true, keepDirty: false });
      }
    } catch {
      // already handled by toast
    }
  }

  async function handleConfirm(formValues: ResourceSettingsFormValues) {
    if (!isPlatform) {
      await handleSubmit(formValues);
      return;
    }

    openDialog({
      title: formValues.enabled
        ? 'Confirm Dedicated Resources'
        : 'Disable Dedicated Resources',
      component: (
        <ResourcesConfirmationDialog
          formValues={formValues}
          onCancel={closeDialog}
          onSubmit={async () => {
            await handleSubmit(formValues);
          }}
        />
      ),
      props: {
        titleProps: { className: 'justify-center pb-1' },
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleConfirm}>
        <SettingsContainer
          title="Compute Resources"
          description="Customize CPU and memory for the services in your project."
          className="gap-0 px-0"
          showSwitch
          switchId="enabled"
          slotProps={{
            submitButton: {
              className: 'hidden',
              'aria-hidden': true,
            },
            switch: {
              onChange: (event) => {
                if (event.target.checked && !hasInitialValues) {
                  applyPresetToForm(form.setValue, form.trigger, 'standard', {
                    shouldDirty: false,
                  });
                }
              },
            },
            footer: { className: 'hidden', 'aria-hidden': true },
          }}
        >
          <ResourcesFormBody initialPrice={initialPrice} />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

function ResourcesFormBody({ initialPrice }: { initialPrice: number }) {
  const enabled = useWatch<ResourceSettingsFormValues>({
    name: 'enabled',
  }) as boolean;

  if (!enabled) {
    return (
      <>
        <div className="px-4 pb-4">
          <Alert>
            <AlertDescription>
              Enable this feature to access custom resource allocation for your
              services.
            </AlertDescription>
          </Alert>
        </div>
        <ResourcesFormFooter />
      </>
    );
  }

  return (
    <Tabs defaultValue="overview" className="flex flex-col">
      <div className="border-b px-4 pt-2 pb-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="overview"
        className="mt-0 flex flex-col gap-4 px-4 py-4"
      >
        <PresetSelector />
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,18rem)]">
          <ResourceBreakdownChart />
          <CostEstimate />
        </div>
        <RatioBanner />
      </TabsContent>

      <TabsContent value="advanced" className="mt-0 flex flex-col">
        <div className="px-4 py-4">
          <RatioBanner />
        </div>
        <ServiceRow
          title="PostgreSQL Database"
          description="Primary OLTP database. Sized independently — no replicas."
          serviceKey="database"
          disableReplicas
        />
        <div className="border-t" />
        <ServiceRow
          title="Hasura GraphQL"
          description="GraphQL API gateway. Scale horizontally with replicas."
          serviceKey="hasura"
        />
        <div className="border-t" />
        <ServiceRow
          title="Auth"
          description="Authentication service."
          serviceKey="auth"
        />
        <div className="border-t" />
        <ServiceRow
          title="Storage"
          description="File storage and image transformations."
          serviceKey="storage"
        />
      </TabsContent>

      <div className="border-t bg-muted/30">
        <CostSummary initialCost={initialPrice} />
      </div>

      <ResourcesFormFooter />
    </Tabs>
  );
}
