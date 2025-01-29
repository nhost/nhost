import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { InfoOutlinedIcon } from '@/components/ui/v2/icons/InfoOutlinedIcon';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

export default function ReplicasFormSection() {
  const {
    register,
    setValue,
    trigger: triggerValidation,
  } = useFormContext<ServiceFormValues>();
  const { replicas, autoscaler } = useWatch<ServiceFormValues>();
  const [autoscalerEnabled, setAutoscalerEnabled] = useState(!!autoscaler);

  const toggleAutoscalerEnabled = async (enabled: boolean) => {
    setAutoscalerEnabled(enabled);

    if (!enabled) {
      setValue('autoscaler', null);
    } else {
      setValue('autoscaler.maxReplicas', 10);
    }
  };

  const handleReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('replicas', updatedReplicas, { shouldDirty: true });

    // TODO Trigger revalidate storage
  };

  const handleMaxReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('autoscaler.maxReplicas', updatedReplicas, { shouldDirty: true });

    triggerValidation('autoscaler.maxReplicas');
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          Replicas ({replicas})
        </Text>
        <Tooltip
          title={
            <Text className="text-white">
              Learn more about{' '}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.nhost.io/platform/service-replicas"
                className="underline"
              >
                Service Replicas
              </a>
            </Text>
          }
        >
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>

      <Box className="flex flex-col justify-between gap-4 lg:flex-row">
        <Box className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <Box className="flex flex-row items-center gap-2">
            <Text className="w-28 lg:w-auto">Replicas</Text>
            <Input
              {...register('replicas')}
              onChange={(event) => handleReplicasChange(event.target.value)}
              type="number"
              id="replicas"
              placeholder="Replicas"
              className="max-w-28"
              hideEmptyHelperText
              fullWidth
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              autoComplete="off"
            />
          </Box>
          <Box className="flex flex-row items-center gap-2">
            <Text className="w-28 text-nowrap lg:w-auto">Max Replicas</Text>
            <Input
              value={autoscaler?.maxReplicas}
              onChange={(event) => handleMaxReplicasChange(event.target.value)}
              type="number"
              id="maxReplicas"
              placeholder="10"
              disabled={!autoscalerEnabled}
              className="max-w-28"
              hideEmptyHelperText
              fullWidth
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              autoComplete="off"
            />
          </Box>
        </Box>
        <Box className="flex flex-row items-center gap-3">
          <Switch
            checked={autoscalerEnabled}
            onChange={(e) => toggleAutoscalerEnabled(e.target.checked)}
            className="self-center"
          />
          <Text>Autoscaler</Text>
          <Tooltip title="Enable autoscaler to automatically provision extra run service replicas when needed.">
            <InfoOutlinedIcon className="h-4 w-4 text-black" />
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
