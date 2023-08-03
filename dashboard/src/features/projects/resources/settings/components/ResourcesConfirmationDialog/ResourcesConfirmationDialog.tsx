import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useProPlan } from '@/features/projects/common/hooks/useProPlan';
import { calculateBillableResources } from '@/features/projects/resources/settings/utils/calculateBillableResources';
import { prettifyMemory } from '@/features/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_PRICE_PER_MINUTE,
} from '@/utils/constants/common';

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

  const priceForTotalAvailableVCPU =
    (formValues.totalAvailableVCPU / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_PRICE;

  const billableResources = calculateBillableResources(
    {
      replicas: formValues.database?.replicas,
      vcpu: formValues.database?.vcpu,
      memory: formValues.database?.memory,
    },
    {
      replicas: formValues.hasura?.replicas,
      vcpu: formValues.hasura?.vcpu,
      memory: formValues.hasura?.memory,
    },
    {
      replicas: formValues.auth?.replicas,
      vcpu: formValues.auth?.vcpu,
      memory: formValues.auth?.memory,
    },
    {
      replicas: formValues.storage?.replicas,
      vcpu: formValues.storage?.vcpu,
      memory: formValues.storage?.memory,
    },
  );

  const totalBillableVCPU = formValues.enabled ? billableResources.vcpu : 0;
  const totalBillableMemory = formValues.enabled ? billableResources.memory : 0;

  const { enabled } = formValues;

  const updatedPrice = enabled
    ? Math.max(
        priceForTotalAvailableVCPU,
        (billableResources.vcpu / RESOURCE_VCPU_MULTIPLIER) *
          RESOURCE_VCPU_PRICE,
      ) + proPlan.price
    : proPlan.price;

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

  const databaseVCPU = enabled ? formValues.database.vcpu : 0;
  const databaseMemory = enabled ? formValues.database.memory : 0;

  const hasuraVCPU = enabled ? formValues.hasura.vcpu : 0;
  const hasuraMemory = enabled ? formValues.hasura.memory : 0;

  const authVCPU = enabled ? formValues.auth.vcpu : 0;
  const authMemory = enabled ? formValues.auth.memory : 0;

  const storageVCPU = enabled ? formValues.storage.vcpu : 0;
  const storageMemory = enabled ? formValues.storage.memory : 0;

  const databaseResources = `${prettifyVCPU(
    databaseVCPU,
  )} vCPU + ${prettifyMemory(databaseMemory)}`;
  const hasuraResources = `${prettifyVCPU(hasuraVCPU)} vCPU + ${prettifyMemory(
    hasuraMemory,
  )}`;
  const authResources = `${prettifyVCPU(authVCPU)} vCPU + ${prettifyMemory(
    authMemory,
  )}`;
  const storageResources = `${prettifyVCPU(
    storageVCPU,
  )} vCPU + ${prettifyMemory(storageMemory)}`;

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      {totalBillableVCPU > 0 ? (
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

        <Box className="grid grid-flow-row gap-1.5">
          <Box className="grid grid-flow-col items-center justify-between gap-2">
            <Box className="grid grid-flow-row gap-0.5">
              <Text className="font-medium">Dedicated Resources</Text>
            </Box>
            <Text>
              $
              {(
                (totalBillableVCPU / RESOURCE_VCPU_MULTIPLIER) *
                RESOURCE_VCPU_PRICE_PER_MINUTE
              ).toFixed(4)}
              /min
            </Text>
          </Box>

          <Box className="grid w-full grid-flow-row gap-1.5">
            <Box className="grid grid-flow-col justify-between gap-2">
              <Text className="text-xs" color="secondary">
                PostgreSQL Database
              </Text>

              <Text className="text-xs" color="secondary">
                {formValues.database.replicas > 1
                  ? `${databaseResources} (${formValues.database.replicas} replicas)`
                  : databaseResources}
              </Text>
            </Box>

            <Box className="grid grid-flow-col justify-between gap-2">
              <Text className="text-xs" color="secondary">
                Hasura GraphQL
              </Text>
              <Text className="text-xs" color="secondary">
                {formValues.hasura.replicas > 1
                  ? `${hasuraResources} (${formValues.hasura.replicas} replicas)`
                  : hasuraResources}
              </Text>
            </Box>

            <Box className="grid grid-flow-col justify-between gap-2">
              <Text className="text-xs" color="secondary">
                Auth
              </Text>
              <Text className="text-xs" color="secondary">
                {formValues.auth.replicas > 1
                  ? `${authResources} (${formValues.auth.replicas} replicas)`
                  : authResources}
              </Text>
            </Box>
            <Box className="grid grid-flow-col justify-between gap-2">
              <Text className="text-xs" color="secondary">
                Storage
              </Text>
              <Text className="text-xs" color="secondary">
                {formValues.storage.replicas > 1
                  ? `${storageResources} (${formValues.storage.replicas} replicas)`
                  : storageResources}
              </Text>
            </Box>

            <Box className="grid grid-flow-col justify-between gap-2">
              <Text className="text-xs font-medium" color="secondary">
                Total
              </Text>
              <Text className="text-xs font-medium" color="secondary">
                {prettifyVCPU(totalBillableVCPU)} vCPU +{' '}
                {prettifyMemory(totalBillableMemory)}
              </Text>
            </Box>
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

          <Text>${updatedPrice.toFixed(2)}/mo</Text>
        </Box>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Button
          color={totalBillableVCPU > 0 ? 'primary' : 'error'}
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
