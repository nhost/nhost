import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import {
  MAX_SERVICES_MEM,
  MEM_CPU_RATIO,
  MIN_SERVICES_MEM,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { isNotEmptyValue } from '@/lib/utils';

interface ComputeFormSectionProps {
  showTooltip?: boolean;
}

export default function ComputeFormSection({
  showTooltip = false,
}: ComputeFormSectionProps) {
  const { setValue } = useFormContext<ServiceFormValues>();

  const formValues = useWatch<ServiceFormValues>();

  const updateMemory = (memory: number) => {
    const boundedMemory = Math.min(
      Math.max(memory, MIN_SERVICES_MEM),
      MAX_SERVICES_MEM,
    );

    setValue('compute.memory', Math.floor(boundedMemory), {
      shouldDirty: true,
    });
    setValue('compute.cpu', Math.floor(boundedMemory / MEM_CPU_RATIO), {
      shouldDirty: true,
    });
  };

  const handleSliderUpdate = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem) || updatedMem < MIN_SERVICES_MEM) {
      return;
    }

    updateMemory(updatedMem);
  };

  const incrementCompute = () => {
    const memory = formValues.compute?.memory;
    if (isNotEmptyValue(memory)) {
      updateMemory(memory + 128);
    }
  };

  const decrementCompute = () => {
    const memory = formValues.compute?.memory;
    if (isNotEmptyValue(memory)) {
      updateMemory(memory - 128);
    }
  };

  const memoryValue = Number(formValues.compute?.memory ?? MIN_SERVICES_MEM);

  return (
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center space-x-2">
        <h4 className="font-semibold">
          vCPUs: {(formValues.compute?.cpu ?? 0) / 1000} / Memory:{' '}
          {formValues.compute?.memory ?? ''}
        </h4>

        {showTooltip && (
          <InfoTooltip>
            Compute resources dedicated for the service. Refer to{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/resources#compute"
              external
              className="font-medium"
            >
              resources
            </TextLink>{' '}
            for more information.
          </InfoTooltip>
        )}
      </div>

      <div className="flex flex-row items-center justify-between space-x-4">
        <Button
          disabled={
            isNotEmptyValue(formValues.compute?.memory) &&
            formValues.compute.memory <= MIN_SERVICES_MEM
          }
          variant="outline"
          size="icon"
          aria-label="Decrease compute"
          onClick={decrementCompute}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>

        <input
          type="range"
          value={memoryValue}
          onChange={(event) => handleSliderUpdate(event.target.value)}
          max={MAX_SERVICES_MEM}
          min={MIN_SERVICES_MEM}
          step={256}
          aria-label="Compute resources"
          className="h-2 w-full cursor-pointer accent-primary"
        />
        <Button
          disabled={
            isNotEmptyValue(formValues.compute?.memory) &&
            formValues.compute.memory >= MAX_SERVICES_MEM
          }
          variant="outline"
          size="icon"
          aria-label="Increase compute"
          onClick={incrementCompute}
        >
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
