import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useProPlan } from '@/features/projects/common/hooks/useProPlan';
import { calculateBillableResources } from '@/features/projects/resources/settings/utils/calculateBillableResources';
import type { ResourceSettingsFormValues } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/constants/common';
import { useFormState, useWatch } from 'react-hook-form';

export default function ResourcesFormFooter() {
  const isPlatform = useIsPlatform();

  const {
    data: proPlan,
    loading: proPlanLoading,
    error: proPlanError,
  } = useProPlan();

  const formState = useFormState<ResourceSettingsFormValues>();
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const enabled = useWatch<ResourceSettingsFormValues>({ name: 'enabled' });
  const [totalAvailableVCPU, database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['totalAvailableVCPU', 'database', 'hasura', 'auth', 'storage']
  >({
    name: ['totalAvailableVCPU', 'database', 'hasura', 'auth', 'storage'],
  });

  if (proPlanLoading) {
    return <ActivityIndicator label="Loading plan details..." delay={1000} />;
  }

  if (proPlanError) {
    throw proPlanError;
  }

  const priceForTotalAvailableVCPU =
    (totalAvailableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

  const billableResources = calculateBillableResources(
    {
      replicas: database?.replicas,
      vcpu: database?.vcpu,
    },
    {
      replicas: hasura?.replicas,
      vcpu: hasura?.vcpu,
    },
    {
      replicas: auth?.replicas,
      vcpu: auth?.vcpu,
    },
    {
      replicas: storage?.replicas,
      vcpu: storage?.vcpu,
    },
  );

  const computeUpdatedPrice = () => {
    if (!isPlatform) {
      return 0;
    }

    if (enabled) {
      return (
        Math.max(
          priceForTotalAvailableVCPU,
          (billableResources.vcpu / RESOURCE_VCPU_MULTIPLIER) *
            RESOURCE_VCPU_PRICE,
        ) + proPlan.price
      );
    }

    return proPlan.price;
  };

  return (
    <Box
      className="grid items-center gap-4 border-t px-4 pt-4 lg:grid-flow-col lg:justify-between lg:gap-2"
      component="footer"
    >
      <Text>
        Learn more about{' '}
        <Link
          href="https://docs.nhost.io/platform/compute-resources"
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
        <Box className="grid grid-flow-col items-center justify-between gap-4">
          <Box className="grid grid-flow-col items-center gap-1.5">
            <Text>
              Approximate cost:{' '}
              <span className="font-medium">
                ${computeUpdatedPrice().toFixed(2)}/mo
              </span>
            </Text>

            <Tooltip title="$0.0012/minute for every 1 vCPU and 2 GiB of RAM">
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
