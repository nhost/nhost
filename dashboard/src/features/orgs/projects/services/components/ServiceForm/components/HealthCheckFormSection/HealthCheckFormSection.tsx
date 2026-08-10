import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import { Switch } from '@/components/ui/v3/switch';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

export default function HealthCheckFormSection() {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();

  const healthCheck = watch('healthCheck');
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(!!healthCheck);

  const toggleHealthCheckEnabled = (enabled: boolean) => {
    setHealthCheckEnabled(enabled);

    if (!enabled) {
      setValue('healthCheck', null);
    }
  };

  return (
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Health Check</h4>

          <InfoTooltip>
            Monitor the health and availability of a service. Refer to{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/health-checks"
              external
              className="font-medium"
            >
              Health Check
            </TextLink>{' '}
            for more information.
          </InfoTooltip>
        </div>

        <Switch
          checked={healthCheckEnabled}
          onCheckedChange={toggleHealthCheckEnabled}
          className="self-center"
        />
      </div>

      {healthCheckEnabled && (
        <div className="flex flex-col space-y-4">
          <div className="space-y-2">
            <Label htmlFor="healthCheck.port">Port</Label>
            <Input
              {...register('healthCheck.port')}
              id="healthCheck.port"
              placeholder="3000"
              className={cn({
                'border-destructive': errors.healthCheck?.port,
              })}
              aria-invalid={!!errors.healthCheck?.port}
              autoComplete="off"
              type="number"
            />
            {errors.healthCheck?.port?.message && (
              <p className="text-destructive text-sm">
                {errors.healthCheck.port.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="healthCheck.initialDelaySeconds">
              Initial delay seconds
            </Label>
            <Input
              {...register('healthCheck.initialDelaySeconds')}
              id="healthCheck.initialDelaySeconds"
              placeholder="30"
              className={cn({
                'border-destructive': errors.healthCheck?.initialDelaySeconds,
              })}
              aria-invalid={!!errors.healthCheck?.initialDelaySeconds}
              autoComplete="off"
              type="number"
            />
            {errors.healthCheck?.initialDelaySeconds?.message && (
              <p className="text-destructive text-sm">
                {errors.healthCheck.initialDelaySeconds.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="healthCheck.probePeriodSeconds">
              Probe period seconds
            </Label>
            <Input
              {...register('healthCheck.probePeriodSeconds')}
              id="healthCheck.probePeriodSeconds"
              placeholder="60"
              className={cn({
                'border-destructive': errors.healthCheck?.probePeriodSeconds,
              })}
              aria-invalid={!!errors.healthCheck?.probePeriodSeconds}
              autoComplete="off"
              type="number"
            />
            {errors.healthCheck?.probePeriodSeconds?.message && (
              <p className="text-destructive text-sm">
                {errors.healthCheck.probePeriodSeconds.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
