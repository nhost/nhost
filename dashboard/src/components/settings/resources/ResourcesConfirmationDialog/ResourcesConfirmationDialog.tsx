import { calculateApproximateCost } from '@/features/settings/resources/utils/calculateApproximateCost';
import { getAllocatedResources } from '@/features/settings/resources/utils/getAllocatedResources';
import { prettifyMemory } from '@/features/settings/resources/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/settings/resources/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/settings/resources/utils/resourceSettingsValidationSchema';
import { useProPlan } from '@/hooks/common/useProPlan';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import { InfoIcon } from '@/ui/v2/icons/InfoIcon';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/CONSTANTS';

export interface ResourcesConfirmationDialogProps {
  /**
   * The updated resources that the user has selected.
   */
  formValues: ResourceSettingsFormValues;
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onSubmit: () => Promise<void>;
}

export default function ResourcesConfirmationDialog({
  formValues,
  onCancel,
  onSubmit,
}: ResourcesConfirmationDialogProps) {
  const { data: proPlan, loading, error } = useProPlan();

  const { vcpu: allocatedVCPU, memory: allocatedMemory } =
    getAllocatedResources(formValues);

  const finalAllocatedVCPU = formValues.enabled ? allocatedVCPU : 0;
  const finalAllocatedMemory = formValues.enabled ? allocatedMemory : 0;

  const priceForTotalAvailableVCPU =
    (RESOURCE_VCPU_PRICE * formValues.totalAvailableVCPU) /
    RESOURCE_VCPU_MULTIPLIER;

  const priceForServicesAndReplicas = calculateApproximateCost(
    RESOURCE_VCPU_PRICE,
    {
      replicas: formValues.database?.replicas,
      vcpu: formValues.database?.vcpu,
    },
    {
      replicas: formValues.hasura?.replicas,
      vcpu: formValues.hasura?.vcpu,
    },
    {
      replicas: formValues.auth?.replicas,
      vcpu: formValues.auth?.vcpu,
    },
    {
      replicas: formValues.storage?.replicas,
      vcpu: formValues.storage?.vcpu,
    },
  );

  const updatedPrice =
    Math.max(priceForTotalAvailableVCPU, priceForServicesAndReplicas) +
    proPlan.price;

  if (!loading && !proPlan) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the plan for this project. Please try again.
      </Alert>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      {finalAllocatedVCPU > 0 ? (
        <Text className="text-center">
          Please allow some time for the selected resources to take effect.
        </Text>
      ) : (
        <Text className="text-center">
          By confirming this you will go back to the original amount of
          resources of the {proPlan.name} plan.
        </Text>
      )}

      <Box className="grid grid-flow-row gap-4">
        <Box className="grid grid-flow-col justify-between gap-2">
          <Text className="font-medium">{proPlan.name} Plan</Text>
          <Text>${proPlan.price.toFixed(2)}/mo</Text>
        </Box>

        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Box className="grid grid-flow-row gap-0.5">
            <Text className="font-medium">Dedicated Resources</Text>
            <Text className="text-xs" color="secondary">
              {prettifyVCPU(finalAllocatedVCPU)} vCPUs +{' '}
              {prettifyMemory(finalAllocatedMemory)} of Memory
            </Text>
          </Box>
          <Text>${updatedPrice.toFixed(2)}/mo</Text>
        </Box>

        <Divider />

        <Box className="grid grid-flow-col justify-between gap-2">
          <Box className="grid grid-flow-col items-center gap-1.5">
            <Text className="font-medium">Approximate Cost</Text>

            <Tooltip title="$0.0012/minute for every 1 vCPU and 2 GiB of RAM">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>

          <Text>${(updatedPrice + proPlan.price).toFixed(2)}/mo</Text>
        </Box>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Button
          color={finalAllocatedVCPU > 0 ? 'primary' : 'error'}
          onClick={onSubmit}
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
