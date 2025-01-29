import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowLeftIcon } from '@/components/ui/v2/icons/ArrowLeftIcon';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import {
  MAX_SERVICES_MEM,
  MEM_CPU_RATIO,
  MIN_SERVICES_MEM,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useFormContext, useWatch } from 'react-hook-form';

interface ComputeFormSectionProps {
  showTooltip?: boolean;
}

export default function ComputeFormSection({
  showTooltip = false,
}: ComputeFormSectionProps) {
  const { setValue } = useFormContext<ServiceFormValues>();

  const formValues = useWatch<ServiceFormValues>();

  const handleSliderUpdate = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem) || updatedMem < MIN_SERVICES_MEM) {
      return;
    }

    setValue('compute.memory', Math.floor(updatedMem), { shouldDirty: true });
    setValue('compute.cpu', Math.floor(updatedMem / MEM_CPU_RATIO), {
      shouldDirty: true,
    });
  };

  const incrementCompute = () => {
    const newMemoryValue = formValues.compute.memory + 128;
    setValue('compute.memory', newMemoryValue, { shouldDirty: true });
    setValue('compute.cpu', Math.floor(newMemoryValue / MEM_CPU_RATIO), {
      shouldDirty: true,
    });
  };

  const decrementCompute = () => {
    const newMemoryValue = formValues.compute.memory - 128;
    setValue('compute.memory', newMemoryValue, { shouldDirty: true });
    setValue('compute.cpu', Math.floor(newMemoryValue / MEM_CPU_RATIO), {
      shouldDirty: true,
    });
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          vCPUs: {formValues.compute.cpu / 1000} / Memory:{' '}
          {formValues.compute.memory}
        </Text>

        {showTooltip && (
          <Tooltip
            title={
              <span>
                Compute resources dedicated for the service. Refer to{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.nhost.io/guides/run/resources#compute"
                  className="underline"
                >
                  resources
                </a>{' '}
                for more information.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        )}
      </Box>

      <Box className="flex flex-row items-center justify-between space-x-4">
        <Button
          disabled={formValues.compute.memory <= MIN_SERVICES_MEM}
          variant="outlined"
          onClick={decrementCompute}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>

        <Slider
          value={Number(formValues.compute.memory)}
          onChange={(_event, value) => handleSliderUpdate(value.toString())}
          max={MAX_SERVICES_MEM}
          min={MIN_SERVICES_MEM}
          step={256}
          aria-label="Compute resources"
          marks
        />
        <Button
          disabled={formValues.compute.memory >= MAX_SERVICES_MEM}
          variant="outlined"
          onClick={incrementCompute}
        >
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </Box>
    </Box>
  );
}
