import { Box } from '@/components/ui/v2/Box';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { MAX_SERVICE_REPLICAS } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { CreateServiceFormValues } from '@/features/run/components/CreateServiceForm';
import { useFormContext, useWatch } from 'react-hook-form';

export default function ReplicasFormSection() {
  const { setValue } = useFormContext<CreateServiceFormValues>();

  const { replicas } = useWatch<CreateServiceFormValues>();

  const handleReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('replicas', updatedReplicas, { shouldDirty: true });

    // TODO Trigger revalidate storage
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Text variant="h4" className="font-semibold">
        Replicas ({replicas})
      </Text>
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
