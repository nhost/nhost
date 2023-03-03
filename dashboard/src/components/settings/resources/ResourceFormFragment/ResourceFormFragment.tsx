import Box from '@/ui/v2/Box';
import Input from '@/ui/v2/Input';
import Slider from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import { RESOURCE_RAM_MULTIPLIER } from '@/utils/CONSTANTS';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import kebabCase from 'just-kebab-case';
import { useFormContext, useWatch } from 'react-hook-form';

export interface ResourceFormFragmentProps {
  /**
   * The title of the form fragment.
   */
  title: string;
  /**
   * The description of the form fragment.
   */
  description: string;
  /**
   * Form field name for CPU.
   */
  cpuKey: keyof ResourceSettingsFormValues;
  /**
   * Form field name for RAM.
   */
  ramKey: keyof ResourceSettingsFormValues;
}

export default function ResourceFormFragment({
  title,
  description,
  cpuKey,
  ramKey,
}: ResourceFormFragmentProps) {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [cpuValue, ramValue] = useWatch<ResourceSettingsFormValues>({
    name: [cpuKey, ramKey],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue(cpuKey, updatedCPU, { shouldDirty: true });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue(ramKey, updatedRAM, { shouldDirty: true });
  }

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-col gap-2">
        <Text variant="h3" className="font-semibold">
          {title}
        </Text>

        <Text color="secondary">{description}</Text>
      </Box>

      <Box className="flex flex-col gap-2">
        <Input
          id={`${kebabCase(title)}-${cpuKey}`}
          value={cpuValue}
          onChange={(event) => handleCPUChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25,
            max: 15,
            step: 0.25,
          }}
          label="Allocated CPU:"
          variant="inline"
          slotProps={{
            label: { className: 'text-base font-normal' },
            formControl: { className: 'flex flex-row gap-2' },
            inputWrapper: { className: 'w-auto' },
            input: { className: 'w-[100px]' },
          }}
        />

        <Slider
          value={cpuValue}
          onChange={(_event, value) => handleCPUChange(value.toString())}
          min={0.25}
          max={15}
          step={0.25}
          aria-label={`${title} CPU Slider`}
          marks
        />
      </Box>

      <Box className="flex flex-col gap-2">
        <Input
          id={`${kebabCase(title)}-${ramKey}`}
          value={ramValue}
          onChange={(event) => handleRAMChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25 * RESOURCE_RAM_MULTIPLIER,
            max: 15 * RESOURCE_RAM_MULTIPLIER,
            step: 0.25 * RESOURCE_RAM_MULTIPLIER,
          }}
          label="Allocated Memory:"
          variant="inline"
          slotProps={{
            label: { className: 'text-base font-normal' },
            formControl: { className: 'flex flex-row gap-2' },
            inputWrapper: { className: 'w-auto' },
            input: { className: 'w-[100px]' },
          }}
          endAdornment={<Text className="pr-2">GiB</Text>}
        />

        <Slider
          value={ramValue}
          onChange={(_event, value) => handleRAMChange(value.toString())}
          min={0.25}
          max={15}
          step={0.25}
          aria-label={`${title} RAM Slider`}
          marks
        />
      </Box>
    </Box>
  );
}
