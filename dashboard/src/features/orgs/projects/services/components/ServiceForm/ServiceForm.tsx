import { yupResolver } from '@hookform/resolvers/yup';
import { CopyIcon, InfoIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { COST_PER_VCPU } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { CommandFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/CommandFormSection';
import { ComputeFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/ComputeFormSection';
import { EnvironmentFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/EnvironmentFormSection';
import { HealthCheckFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/HealthCheckFormSection';
import { ImageFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/ImageFormSection';
import { PortsFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection';
import { ReplicasFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/ReplicasFormSection';
import { ServiceConfirmationDialog } from '@/features/orgs/projects/services/components/ServiceForm/components/ServiceConfirmationDialog';
import { StorageFormSection } from '@/features/orgs/projects/services/components/ServiceForm/components/StorageFormSection';
import {
  defaultServiceFormValues,
  type ServiceFormProps,
  type ServiceFormValues,
  validationSchema,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { getFormattedServiceConfig } from '@/features/orgs/projects/services/utils/getFormattedServiceConfig';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useInsertRunServiceConfigMutation,
  useReplaceRunServiceConfigMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn } from '@/lib/utils';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';
import { copy } from '@/utils/copy';

const NEW_SERVICE_ID_PLACEHOLDER = '<uuid-to-be-generated-on-creation>';

export default function ServiceForm({
  serviceID,
  initialData,
  onSubmit,
  onCancel,
  location,
}: ServiceFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const hostName = useHostName();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { onDirtyStateChange, openDialog, closeDialog } = useDialog();
  const { project } = useProject();
  const track = useTrackEvent();
  const [insertRunServiceConfig] = useInsertRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });
  const [replaceRunServiceConfig] = useReplaceRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const [createServiceFormError, setCreateServiceFormError] =
    useState<Error | null>(null);

  const form = useForm<ServiceFormValues>({
    defaultValues: initialData ?? defaultServiceFormValues,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    watch,
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting, dirtyFields },
    reset,
  } = form;

  const formValues = watch();

  const isDirty = Object.keys(dirtyFields).length > 0;

  const serviceIDOrPlaceholder = useMemo(
    () => serviceID || NEW_SERVICE_ID_PLACEHOLDER,
    [serviceID],
  );

  const privateRegistryImage = `registry.${project?.region.name}.${project?.region.domain}/${serviceIDOrPlaceholder}`;

  let initialImageType: 'public' | 'private' | 'nhost' = 'public';

  if (initialData?.image?.startsWith(privateRegistryImage.split('/')[0])) {
    initialImageType = 'nhost';
  }

  if ((initialData?.pullCredentials?.length ?? 0) > 0) {
    initialImageType = 'private';
  }

  const [imageType, setImageType] = useState<'public' | 'private' | 'nhost'>(
    initialImageType,
  );

  const initialImageTag = useMemo(
    () => initialData?.image?.split(':')[1],
    [initialData?.image],
  );

  const handleImageTypeChange = (value: 'public' | 'private' | 'nhost') => {
    if (value === initialImageType) {
      reset({
        ...formValues,
        image: initialData?.image,
        pullCredentials: initialData?.pullCredentials,
      });
    } else {
      reset({
        ...formValues,
        image: '',
        pullCredentials: undefined,
      });
    }

    setImageType(value);
  };

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const createOrUpdateService = async (values: ServiceFormValues) => {
    const config = getFormattedServiceConfig({ values, initialData });

    if (serviceID) {
      // Update service config
      await replaceRunServiceConfig({
        variables: {
          appID: project?.id,
          serviceID,
          config,
        },
      });

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
      // Create service
      await insertRunServiceConfig({
        variables: {
          appID: project?.id,
          config: {
            ...config,
            image: {
              image: values.image,
              pullCredentials:
                (values.pullCredentials?.length ?? 0) > 0
                  ? values.pullCredentials
                  : null,
            },
          },
        },
      });
      track('Run Service Created');
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

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const isModifierEnter =
      event.key === 'Enter' && (event.ctrlKey || event.metaKey);

    if (!isModifierEnter || isSubmitting) {
      return;
    }

    const submitButton = Array.from(
      formRef.current!.getElementsByTagName('button'),
    ).find((item) => item.type === 'submit');

    if (submitButton?.disabled) {
      return;
    }

    event.preventDefault();
    handleFormSubmit(handleConfirm)(event);
  };

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
    const config = getFormattedServiceConfig({
      values: formValues,
      initialData,
    });

    const base64Config = btoa(JSON.stringify(config));

    const link = `${hostName}/run-one-click-install?config=${base64Config}`;

    copy(link, 'Service Config');
  };

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        onSubmit={handleFormSubmit(handleConfirm)}
        onKeyDown={handleKeyDown}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <div className="space-y-2">
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="name">Name</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Info" className="flex">
                  <InfoIcon className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Name of the service, must be unique per project.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            {...register('name')}
            id="name"
            placeholder="Service name"
            className={cn({ 'border-destructive': errors.name })}
            aria-invalid={!!errors.name}
            autoComplete="off"
            autoFocus
          />
          {errors.name?.message && (
            <p className="text-destructive text-sm">{errors.name.message}</p>
          )}
        </div>

        <CommandFormSection />

        {isPlatform ? (
          <Alert
            variant="info"
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

        <ImageFormSection
          onImageTypeChange={handleImageTypeChange}
          imageType={imageType}
          initialImageTag={initialImageTag}
          privateRegistryImage={privateRegistryImage}
          serviceID={serviceID}
        />

        <ComputeFormSection showTooltip />

        <ReplicasFormSection />

        <EnvironmentFormSection />

        <PortsFormSection />

        <StorageFormSection />

        <HealthCheckFormSection />

        {createServiceFormError && (
          <Alert
            variant="destructive"
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createServiceFormError.message}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
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
            <Button type="submit" disabled={isSubmitting}>
              {serviceID ? (
                <RefreshCwIcon className="mr-2 h-4 w-4" />
              ) : (
                <PlusIcon className="mr-2 h-4 w-4" />
              )}
              {serviceID ? 'Update' : 'Create'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={copyConfig}
            >
              <CopyIcon className="mr-2 h-4 w-4" />
              Copy one-click install link
            </Button>
          </div>

          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
