import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Text from '@/ui/v2/Text';
import { RESOURCE_VCPU_PRICE } from '@/utils/CONSTANTS';

export interface ResourcesConfirmationDialogProps {
  /**
   * Price of the new plan.
   */
  updatedResources: {
    cpu: number;
    memory: number;
  };
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onSubmit: () => void;
}

export default function ResourcesConfirmationDialog({
  updatedResources,
  onCancel,
  onSubmit,
}: ResourcesConfirmationDialogProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const updatedPrice = RESOURCE_VCPU_PRICE * updatedResources.cpu;

  if (!currentApplication) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the plan for this project. Please try again.
      </Alert>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <Text className="text-center">
        Please allow some time for the additional resources to appear.
      </Text>

      <Box className="grid grid-flow-row gap-4">
        <Box className="grid grid-flow-col justify-between gap-2">
          <Text className="font-medium">
            {currentApplication.plan.name} Plan
          </Text>
          <Text>${currentApplication.plan.price.toFixed(2)}/mo</Text>
        </Box>

        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Box className="grid grid-flow-row gap-0.5">
            <Text className="font-medium">Resources</Text>
            <Text className="text-xs" color="secondary">
              {updatedResources.cpu} vCPUs + {updatedResources.memory} GiB of
              Memory
            </Text>
          </Box>
          <Text>${updatedPrice.toFixed(2)}/mo</Text>
        </Box>

        <Divider />

        <Box className="grid grid-flow-col justify-between gap-2">
          <Text className="font-medium">Total</Text>
          <Text>
            ${(updatedPrice + currentApplication.plan.price).toFixed(2)}/mo
          </Text>
        </Box>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Button onClick={onSubmit}>Confirm</Button>

        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </div>
  );
}
