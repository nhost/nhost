import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Slider } from '@/components/ui/v2/Slider';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  MAX_SERVICES_CPU,
  MAX_SERVICES_MEM,
  MEM_CPU_RATIO,
  MIN_SERVICES_CPU,
  MIN_SERVICES_MEM,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';

interface EditServiceComputeFormValues
  extends Pick<CreateServiceFormValues, 'compute'> {}
interface ServiceComputeFormSectionProps extends EditServiceComputeFormValues {}

export default function EditServiceCompute({
  compute,
}: ServiceComputeFormSectionProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServiceComputeFormValues>({
    defaultValues: {
      compute: {
        cpu: compute.cpu,
        memory: compute.memory,
      },
    },
  });

  const { reset, register, setValue, formState, control } = form;

  const formValues = useWatch<CreateServiceFormValues>({
    control,
  });

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const handleSliderUpdate = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem) || updatedMem < MIN_SERVICES_MEM) {
      return;
    }

    setValue('compute.memory', Math.floor(updatedMem));
    setValue('compute.cpu', Math.floor(updatedMem / 2.048));
  };

  const handleCPUInputValueChange = (value: string) => {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('compute.memory', Math.floor(updatedCPU * MEM_CPU_RATIO));
  };

  const checkCPUBounds = (value: string) => {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      setValue('compute.cpu', MIN_SERVICES_CPU);
      setValue('compute.memory', MIN_SERVICES_MEM);
      return;
    }

    if (updatedCPU < MIN_SERVICES_CPU) {
      setValue('compute.cpu', MIN_SERVICES_CPU);
      setValue('compute.memory', MIN_SERVICES_MEM);
      return;
    }

    if (updatedCPU > MAX_SERVICES_CPU) {
      setValue('compute.cpu', MAX_SERVICES_CPU);
      setValue('compute.memory', MAX_SERVICES_MEM);
    }

    setValue(
      'compute.cpu',
      Math.floor(formValues.compute.memory / MEM_CPU_RATIO),
    );
  };

  const handleMemoryInputValueChange = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem)) {
      return;
    }

    setValue('compute.cpu', Math.floor(updatedMem / MEM_CPU_RATIO));
  };

  const checkMemBounds = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem)) {
      setValue('compute.cpu', MIN_SERVICES_CPU);
      setValue('compute.memory', MIN_SERVICES_MEM);
      return;
    }

    if (updatedMem < MIN_SERVICES_MEM) {
      setValue('compute.cpu', MIN_SERVICES_CPU);
      setValue('compute.memory', MIN_SERVICES_MEM);
      return;
    }

    if (updatedMem > MAX_SERVICES_MEM) {
      setValue('compute.cpu', MAX_SERVICES_CPU);
      setValue('compute.memory', MAX_SERVICES_MEM);
    }
  };

  const handleEditCompute = async (values: EditServiceComputeFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              resources: {
                compute: {
                  cpu: Number(values.compute.cpu),
                  memory: Number(values.compute.memory),
                },
              },
            },
          },
        }),
        {
          loading: 'Updating...',
          success: () => {
            // Reset the form state to disable the save button
            reset({}, { keepValues: true });
            return 'The service has been updated successfully.';
          },
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while updating the service. Please try again.'
            );
          },
        },
        getToastStyleProps(),
      );
    } catch {
      // Note: error is handled by the toast
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditCompute}>
        <SettingsContainer
          title="Compute"
          slotProps={{
            submitButton: {
              disabled:
                compute.cpu === formValues.compute.cpu ||
                compute.memory === formValues.compute.memory,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Box className="flex flex-row space-x-2">
            <Input
              {...register('compute.cpu', {
                onChange: (event) =>
                  handleCPUInputValueChange(event.target.value),
                onBlur: (event) => checkCPUBounds(event.target.value),
              })}
              id="compute.cpu"
              label="CPU"
              className="w-full"
              hideEmptyHelperText
              error={!!formState.errors?.compute?.cpu}
              helperText={formState.errors?.compute?.cpu.message}
              fullWidth
              autoComplete="off"
              type="number"
              slotProps={{
                inputRoot: {
                  min: MIN_SERVICES_CPU,
                  max: MAX_SERVICES_CPU,
                },
              }}
            />
            <Input
              {...register('compute.memory', {
                onChange: (event) =>
                  handleMemoryInputValueChange(event.target.value),
                onBlur: (event) => checkMemBounds(event.target.value),
              })}
              id="compute.memory"
              label="Memory"
              className="w-full"
              hideEmptyHelperText
              error={!!formState.errors?.compute?.memory}
              helperText={formState.errors?.compute?.memory?.message}
              fullWidth
              autoComplete="off"
              type="number"
              slotProps={{
                inputRoot: {
                  step: 128,
                  min: MIN_SERVICES_MEM,
                  max: MAX_SERVICES_MEM,
                },
              }}
            />
          </Box>
          <Slider
            value={Number(formValues.compute.memory)}
            onChange={(_event, value) => handleSliderUpdate(value.toString())}
            max={MAX_SERVICES_MEM}
            min={MIN_SERVICES_MEM}
            step={256}
            aria-label="Compute resources"
            marks
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
