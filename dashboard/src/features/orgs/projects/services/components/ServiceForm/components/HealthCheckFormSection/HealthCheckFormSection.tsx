import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function HealthCheckFormSection() {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const healthCheck = watch('healthCheck');
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(!!healthCheck);

  const toggleHealthCheckEnabled = async (enabled: boolean) => {
    setHealthCheckEnabled(enabled);

    if (!enabled) {
      setValue('healthCheck', null);
    }
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Health Check
          </Text>

          <Tooltip
            title={
              <span>
                Monitor the health and availability of a service. Refer to{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.nhost.io/guides/run/health-checks"
                  className="underline"
                >
                  Health Check
                </a>{' '}
                for more information.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>

        <Switch
          checked={healthCheckEnabled}
          onChange={(e) => toggleHealthCheckEnabled(e.target.checked)}
          className="self-center"
        />
      </Box>

      {healthCheckEnabled && (
        <Box className="flex flex-col space-y-4">
          <Input
            {...register(`healthCheck.port`)}
            id="healthCheck.port"
            label="Port"
            placeholder="3000"
            className="w-full"
            hideEmptyHelperText
            error={!!errors?.healthCheck?.port}
            helperText={errors?.healthCheck?.port?.message}
            fullWidth
            autoComplete="off"
            type="number"
          />

          <Input
            {...register(`healthCheck.initialDelaySeconds`)}
            id="healthCheck.initialDelaySeconds"
            label="Initial delay seconds"
            placeholder="30"
            className="w-full"
            hideEmptyHelperText
            error={!!errors?.healthCheck?.initialDelaySeconds}
            helperText={errors?.healthCheck?.initialDelaySeconds?.message}
            fullWidth
            autoComplete="off"
            type="number"
          />

          <Input
            {...register(`healthCheck.probePeriodSeconds`)}
            id="healthCheck.probePeriodSeconds"
            label="Probe period seconds"
            placeholder="60"
            className="w-full"
            hideEmptyHelperText
            error={!!errors?.healthCheck?.probePeriodSeconds}
            helperText={errors?.healthCheck?.probePeriodSeconds?.message}
            fullWidth
            autoComplete="off"
            type="number"
          />
        </Box>
      )}
    </Box>
  );
}
