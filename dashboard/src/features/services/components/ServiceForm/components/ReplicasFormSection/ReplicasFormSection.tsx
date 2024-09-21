import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { MAX_SERVICE_REPLICAS } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useFormContext, useWatch } from 'react-hook-form';

export default function ReplicasFormSection() {
  const { setValue } = useFormContext<ServiceFormValues>();

  const { replicas } = useWatch<ServiceFormValues>();

  const handleReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('replicas', updatedReplicas, { shouldDirty: true });

    // TODO Trigger revalidate storage
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          Replicas ({replicas})
        </Text>
        <Tooltip
          title={
            <span>
              Number of replicas for the service. Multiple replicas can process
              requests/work in parallel. You can set replicas to 0 to pause the
              service. Refer to{' '}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.nhost.io/guides/run/resources"
              >
                resources
              </a>{' '}
              for more information.
            </span>
          }
        >
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <Slider
        value={replicas}
        onChange={(_event, value) => handleReplicasChange(value.toString())}
        min={0}
        max={MAX_SERVICE_REPLICAS}
        step={1}
        aria-label="Replicas"
        marks
      />
    </Box>
  );
}
