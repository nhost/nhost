import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowsClockwise } from '@/components/ui/v2/icons/ArrowsClockwise';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useHostName } from '@/features/projects/common/hooks/useHostName';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import { COST_PER_VCPU } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { ComputeFormSection } from '@/features/services/components/ServiceForm/components/ComputeFormSection';
import { EnvironmentFormSection } from '@/features/services/components/ServiceForm/components/EnvironmentFormSection';
import { PortsFormSection } from '@/features/services/components/ServiceForm/components/PortsFormSection';
import { ReplicasFormSection } from '@/features/services/components/ServiceForm/components/ReplicasFormSection';
import { StorageFormSection } from '@/features/services/components/ServiceForm/components/StorageFormSection';

import {
  validationSchema,
  type ServiceFormProps,
  type ServiceFormValues,
} from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  useInsertRunServiceConfigMutation,
  useReplaceRunServiceConfigMutation,
  type ConfigRunServiceConfigInsertInput,
} from '@/utils/__generated__/graphql';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { removeTypename } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { parse } from 'shell-quote';
import { HealthCheckFormSection } from './components/HealthCheckFormSection';
import { ServiceConfirmationDialog } from './components/ServiceConfirmationDialog';
import { ServiceDetailsDialog } from './components/ServiceDetailsDialog';

export default function ServiceForm({
  serviceID,
  initialData,
  onSubmit,
  onCancel,
  location,
}: ServiceFormProps) {
  const hostName = useHostName();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { onDirtyStateChange, openDialog, closeDialog } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [insertRunServiceConfig] = useInsertRunServiceConfigMutation();
  const [replaceRunServiceConfig] = useReplaceRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });
  const [detailsServiceId, setDetailsServiceId] = useState('');
  const [detailsServiceSubdomain, setDetailsServiceSubdomain] = useState(
    initialData?.subdomain,
  );

  const [createServiceFormError, setCreateServiceFormError] =
    useState<Error | null>(null);

  const form = useForm<ServiceFormValues>({
    defaultValues: initialData ?? {
      compute: {
        cpu: 62,
        memory: 128,
      },
      replicas: 1,
      autoscaler: null,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    watch,
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const formValues = watch();

  const serviceImage = watch('image');

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const getFormattedConfig = (values: ServiceFormValues) => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as ServiceFormValues;
    const sanitizedInitialDataPorts = initialData?.ports
      ? removeTypename(initialData.ports)
      : [];

    const config: ConfigRunServiceConfigInsertInput = {
      name: sanitizedValues.name,
      image: {
        image: sanitizedValues.image,
      },
      command: parse(sanitizedValues.command).map((item) => item.toString()),
      resources: {
        compute: {
          cpu: sanitizedValues.compute.cpu,
          memory: sanitizedValues.compute.memory,
        },
        storage: sanitizedValues.storage.map((item) => ({
          name: item.name,
          path: item.path,
          capacity: item.capacity,
        })),
        replicas: sanitizedValues.replicas,
        autoscaler: sanitizedValues.autoscaler
          ? {
              maxReplicas: sanitizedValues.autoscaler?.maxReplicas,
            }
          : null,
      },
      environment: sanitizedValues.environment.map((item) => ({
        name: item.name,
        value: item.value,
      })),
      ports: sanitizedValues.ports.map((item) => ({
        port: item.port,
        type: item.type,
        publish: item.publish,
        ingresses: item.ingresses,
        rateLimit:
          sanitizedInitialDataPorts.find(
            (port) => port.port === item.port && port.type === item.type,
          )?.rateLimit ?? null,
      })),
      healthCheck: sanitizedValues.healthCheck
        ? {
            port: sanitizedValues.healthCheck?.port,
            initialDelaySeconds:
              sanitizedValues.healthCheck?.initialDelaySeconds,
            probePeriodSeconds: sanitizedValues.healthCheck?.probePeriodSeconds,
          }
        : null,
    };

    return config;
  };

  const createOrUpdateService = async (values: ServiceFormValues) => {
    const config = getFormattedConfig(values);

    if (serviceID) {
      // Update service config
      await replaceRunServiceConfig({
        variables: {
          appID: currentProject.id,
          serviceID,
          config,
        },
      });

      setDetailsServiceId(serviceID);

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
    } else {
      // Insert service config
      const {
        data: {
          insertRunServiceConfig: { serviceID: newServiceID },
        },
      } = await insertRunServiceConfig({
        variables: {
          appID: currentProject.id,
          config: {
            ...config,
            image: {
              // If the image field left empty then we auto-populate following this format
              // registry.<region>.<nhost_domain>/<service_id>
              image:
                values.image.length > 0
                  ? values.image
                  : `registry.${currentProject.region.name}.${currentProject.region.domain}/<uuid-to-be-generated-on-creation>`,
            },
          },
        },
      });

      setDetailsServiceId(newServiceID);
      setDetailsServiceSubdomain('');
    }
  };

  const handleSubmit = async (values: ServiceFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        await createOrUpdateService(values);
        onSubmit?.();
      },
      {
        loadingMessage: 'Configuring the service...',
        successMessage: 'The service has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the service. Please try again.',
      },
    );
  };

  const handleConfirm = async (values: ServiceFormValues) => {
    if (!isPlatform) {
      await handleSubmit(formValues);
      return;
    }

    openDialog({
      title: 'Confirm Resources',
      component: (
        <ServiceConfirmationDialog
          formValues={values}
          onCancel={closeDialog}
          onSubmit={async () => {
            await handleSubmit(formValues);
          }}
        />
      ),
    });
  };

  useEffect(() => {
    if (!isPlatform) {
      return;
    }

    if (detailsServiceId) {
      openDialog({
        title: 'Service Details',
        component: (
          <ServiceDetailsDialog
            serviceID={detailsServiceId}
            subdomain={detailsServiceSubdomain}
            ports={formValues.ports}
          />
        ),
        props: {
          PaperProps: {
            className: 'max-w-2xl',
          },
        },
      });
    }
  }, [
    detailsServiceId,
    detailsServiceSubdomain,
    formValues,
    openDialog,
    isPlatform,
  ]);

  const pricingExplanation = () => {
    const vCPUs = `${formValues.compute.cpu / RESOURCE_VCPU_MULTIPLIER} vCPUs`;
    const mem = `${formValues.compute.memory} MiB Mem`;
    let details = `${vCPUs} + ${mem}`;

    if (formValues.replicas > 1) {
      details = `(${details}) x ${formValues.replicas} replicas`;
    }

    return `Approximate cost for ${details}`;
  };

  const copyConfig = () => {
    const config = getFormattedConfig(formValues);

    const base64Config = btoa(JSON.stringify(config));

    const link = `${hostName}/run-one-click-install?config=${base64Config}`;

    copy(link, 'Service Config');
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleConfirm}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <Input
          {...register('name')}
          id="name"
          label={
            <Box className="flex flex-row items-center space-x-2">
              <Text>Name</Text>
              <Tooltip title="Name of the service, must be unique per project.">
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>
          }
          placeholder="Service name"
          hideEmptyHelperText
          error={!!errors.name}
          helperText={errors?.name?.message}
          fullWidth
          autoComplete="off"
          autoFocus
        />

        <Input
          {...register('image')}
          id="image"
          label={
            <Box className="flex flex-row items-center space-x-2">
              <Text>Image</Text>
              <Tooltip
                title={
                  <span>
                    Image to use, it can be hosted on any public registry or it
                    can use the{' '}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://docs.nhost.io/run/registry"
                      className="underline"
                    >
                      Nhost registry
                    </a>
                    . Image needs to support arm.
                  </span>
                }
              >
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>
          }
          placeholder="To automatically fill the private registry, leave it blank."
          hideEmptyHelperText
          error={!!errors.image}
          helperText={errors?.image?.message}
          fullWidth
          autoComplete="off"
        />

        {/* This shows only when trying to edit a service and when running against the nhost platform */}
        {isPlatform && serviceID && serviceImage && (
          <InfoCard
            title="Private registry"
            value={`registry.${currentProject.region.name}.${currentProject.region.domain}/${serviceID}`}
          />
        )}

        <Input
          {...register('command')}
          id="command"
          label={
            <Box className="flex flex-row items-center space-x-2">
              <Text>Command</Text>
              <Tooltip title="Command to run when to start the service. This is optional as the image may already have a baked-in command.">
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>
          }
          placeholder="$ npm start"
          hideEmptyHelperText
          error={!!errors.command}
          helperText={errors?.command?.message}
          fullWidth
          autoComplete="off"
        />

        {isPlatform ? (
          <Alert
            severity="info"
            className="flex items-center justify-between space-x-2"
          >
            <span>{pricingExplanation()}</span>
            <b>
              $
              {parseFloat(
                (
                  formValues.compute.cpu *
                  formValues.replicas *
                  COST_PER_VCPU
                ).toFixed(2),
              )}
            </b>
          </Alert>
        ) : null}

        <ComputeFormSection showTooltip />

        <ReplicasFormSection />

        <EnvironmentFormSection />

        <PortsFormSection />

        <StorageFormSection />

        <HealthCheckFormSection />

        {createServiceFormError && (
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createServiceFormError.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              size="small"
              onClick={() => {
                setCreateServiceFormError(null);
              }}
            >
              Clear
            </Button>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              startIcon={serviceID ? <ArrowsClockwise /> : <PlusIcon />}
            >
              {serviceID ? 'Update' : 'Create'}
            </Button>
            <Button
              color="secondary"
              variant="outlined"
              disabled={isSubmitting}
              onClick={copyConfig}
              startIcon={<CopyIcon />}
            >
              Copy one-click install link
            </Button>
          </div>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
