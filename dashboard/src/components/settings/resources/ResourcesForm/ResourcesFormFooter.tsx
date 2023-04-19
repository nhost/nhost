import { calculateApproximateCost } from '@/features/settings/resources/utils/calculateApproximateCost';
import type { ResourceSettingsFormValues } from '@/features/settings/resources/utils/resourceSettingsValidationSchema';
import { useProPlan } from '@/hooks/common/useProPlan';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import { InfoIcon } from '@/ui/v2/icons/InfoIcon';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/CONSTANTS';
import { useFormState, useWatch } from 'react-hook-form';

export default function ResourcesFormFooter() {
  const {
    data: proPlan,
    loading: proPlanLoading,
    error: proPlanError,
  } = useProPlan();

  const formState = useFormState<ResourceSettingsFormValues>();
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const enabled = useWatch<ResourceSettingsFormValues>({ name: 'enabled' });
  const [
    totalAvailableVCPU,
    databaseReplicas,
    databaseVCPU,
    hasuraReplicas,
    hasuraVCPU,
    authReplicas,
    authVCPU,
    storageReplicas,
    storageVCPU,
  ] = useWatch<
    ResourceSettingsFormValues,
    [
      'totalAvailableVCPU',
      'databaseReplicas',
      'databaseVCPU',
      'hasuraReplicas',
      'hasuraVCPU',
      'authReplicas',
      'authVCPU',
      'storageReplicas',
      'storageVCPU',
    ]
  >({
    name: [
      'totalAvailableVCPU',
      'databaseReplicas',
      'databaseVCPU',
      'hasuraReplicas',
      'hasuraVCPU',
      'authReplicas',
      'authVCPU',
      'storageReplicas',
      'storageVCPU',
    ],
  });

  if (proPlanLoading) {
    return <ActivityIndicator label="Loading plan details..." delay={1000} />;
  }

  if (proPlanError) {
    throw proPlanError;
  }

  const priceForTotalAvailableVCPU =
    proPlan.price +
    (RESOURCE_VCPU_PRICE * totalAvailableVCPU) / RESOURCE_VCPU_MULTIPLIER;

  const priceForServicesAndReplicas = calculateApproximateCost(
    RESOURCE_VCPU_PRICE,
    {
      replicas: databaseReplicas,
      vcpu: databaseVCPU,
    },
    {
      replicas: hasuraReplicas,
      vcpu: hasuraVCPU,
    },
    {
      replicas: authReplicas,
      vcpu: authVCPU,
    },
    {
      replicas: storageReplicas,
      vcpu: storageVCPU,
    },
  );

  const updatedPrice =
    enabled && isDirty
      ? Math.max(priceForTotalAvailableVCPU, priceForServicesAndReplicas) +
        proPlan.price
      : proPlan.price;

  return (
    <Box
      className="grid grid-flow-col items-center justify-between border-t px-4 pt-4"
      component="footer"
    >
      <Text>
        Learn more about{' '}
        <Link
          href="https://docs.nhost.io/platform/compute"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          className="font-medium"
        >
          Compute Resources
          <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
        </Link>
      </Text>

      {(enabled || isDirty) && (
        <Box className="grid grid-flow-col items-center gap-4">
          <Box className="grid grid-flow-col items-center gap-1.5">
            <Text>
              Approximate cost:{' '}
              <span className="font-medium">${updatedPrice.toFixed(2)}/mo</span>
            </Text>

            <Tooltip title="This is just an estimation.">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>

          <Button
            type="submit"
            variant={isDirty ? 'contained' : 'outlined'}
            color={isDirty ? 'primary' : 'secondary'}
            disabled={!isDirty}
          >
            Save
          </Button>
        </Box>
      )}
    </Box>
  );
}
