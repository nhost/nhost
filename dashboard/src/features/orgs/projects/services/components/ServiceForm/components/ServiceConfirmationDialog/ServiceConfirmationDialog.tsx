import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { COST_PER_VCPU } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';
import { useState } from 'react';

export interface ServiceConfirmationDialogProps {
  /**
   * The updated resources that the user has selected.
   */
  formValues: ServiceFormValues;
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onSubmit: () => Promise<void>;
}

export default function ServiceConfirmationDialog({
  formValues,
  onCancel,
  onSubmit,
}: ServiceConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approximatePriceForService = parseFloat(
    (formValues.compute.cpu * formValues.replicas * COST_PER_VCPU).toFixed(2),
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <Box className="grid grid-flow-row gap-4">
        <Box className="grid grid-flow-row gap-1.5">
          <Box className="grid grid-flow-col items-center justify-between gap-2">
            <Box className="grid grid-flow-row gap-0.5">
              <Text color="secondary">vCPUs</Text>
            </Box>
            <Text>{formValues.compute.cpu / RESOURCE_VCPU_MULTIPLIER}</Text>
          </Box>

          <Box className="grid grid-flow-col items-center justify-between gap-2">
            <Box className="grid grid-flow-row gap-0.5">
              <Text color="secondary">Memory</Text>
            </Box>
            <Text>{formValues.compute.memory} MiB</Text>
          </Box>

          <Box className="grid grid-flow-col items-center justify-between gap-2">
            <Box className="grid grid-flow-row gap-0.5">
              <Text color="secondary">Replicas</Text>
            </Box>
            <Text>{formValues.replicas}</Text>
          </Box>
        </Box>

        <Divider />

        <Box className="grid grid-flow-col justify-between gap-2">
          <Box className="grid grid-flow-col items-center gap-1.5">
            <Text className="font-medium">Approximate Cost</Text>

            <Tooltip title="$0.0012/minute for every 1 vCPU and 2 GiB of RAM">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>

          <Text>${approximatePriceForService}/mo</Text>
        </Box>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Button
          loading={isSubmitting}
          color="primary"
          onClick={handleSubmit}
          autoFocus
        >
          Confirm
        </Button>

        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </div>
  );
}
