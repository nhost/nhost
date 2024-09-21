import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Slider } from '@/components/ui/v2/Slider';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { MAX_SERVICE_REPLICAS } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function AutoscalerFormSection() {
  const {
    watch,
    setValue,
    formState: { errors },
    trigger: triggerValidation,
  } = useFormContext<ServiceFormValues>();

  const handleMaxReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('autoscaler.maxReplicas', updatedReplicas, { shouldDirty: true });

    triggerValidation('autoscaler.maxReplicas');
  };

  const autoscaler = watch('autoscaler');
  const maxReplicas = autoscaler?.maxReplicas;
  const [autoscalerEnabled, setAutoscalerEnabled] = useState(!!autoscaler);

  const toggleAutoscalerEnabled = async (enabled: boolean) => {
    setAutoscalerEnabled(enabled);

    if (!enabled) {
      setValue('autoscaler', null);
    } else {
      setValue('autoscaler.maxReplicas', 10);
    }
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Autoscaler
          </Text>
          <Tooltip
            title={
              <span>
                Enable this feature to automatically provision extra replicas
                when needed.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>

        <Switch
          checked={autoscalerEnabled}
          onChange={(e) => toggleAutoscalerEnabled(e.target.checked)}
          className="self-center"
        />
      </Box>

      {autoscalerEnabled && (
        <Box className="flex flex-col space-y-4">
          <Text>Max Replicas ({maxReplicas})</Text>
          <Slider
            value={maxReplicas}
            defaultValue={2}
            onChange={(_event, value) =>
              handleMaxReplicasChange(value.toString())
            }
            min={0}
            max={MAX_SERVICE_REPLICAS}
            step={1}
            aria-label="Replicas"
            marks
          />
        </Box>
      )}
    </Box>
  );
}
