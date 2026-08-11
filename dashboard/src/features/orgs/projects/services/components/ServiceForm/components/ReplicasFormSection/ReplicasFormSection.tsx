import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import { Switch } from '@/components/ui/v3/switch';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

export default function ReplicasFormSection() {
  const {
    register,
    setValue,
    trigger: triggerValidation,
    formState: { errors },
  } = useFormContext<ServiceFormValues>();
  const { replicas, autoscaler } = useWatch<ServiceFormValues>();
  const [autoscalerEnabled, setAutoscalerEnabled] = useState(!!autoscaler);

  const toggleAutoscalerEnabled = (enabled: boolean) => {
    setAutoscalerEnabled(enabled);

    if (!enabled) {
      setValue('autoscaler', null);
    } else {
      setValue('autoscaler.maxReplicas', 10);
    }
  };

  const handleReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('replicas', updatedReplicas, { shouldDirty: true });

    // TODO Trigger revalidate storage
  };

  const handleMaxReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue('autoscaler.maxReplicas', updatedReplicas, { shouldDirty: true });

    triggerValidation('autoscaler.maxReplicas');
  };

  return (
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center space-x-2">
        <h4 className="font-semibold">Replicas ({replicas})</h4>
        <InfoTooltip>
          Learn more about{' '}
          <TextLink
            href="https://docs.nhost.io/platform/cloud/service-replicas"
            external
            className="font-medium"
          >
            Service Replicas
          </TextLink>
        </InfoTooltip>
      </div>

      <div className="flex flex-col justify-between gap-4 lg:flex-row">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <div className="flex flex-row items-start gap-2">
            <Label htmlFor="replicas" className="mt-2 w-28 lg:w-auto">
              Replicas
            </Label>
            <div className="space-y-1">
              <Input
                {...register('replicas')}
                onChange={(event) => handleReplicasChange(event.target.value)}
                type="number"
                id="replicas"
                placeholder="Replicas"
                className={cn('max-w-28', {
                  'border-destructive': errors.replicas,
                })}
                aria-invalid={!!errors.replicas}
                onWheel={(event) => (event.target as HTMLInputElement).blur()}
                autoComplete="off"
                min={0}
              />
              {errors.replicas?.message && (
                <p className="text-destructive text-sm">
                  {errors.replicas.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-row items-start gap-2">
            <Label
              htmlFor="maxReplicas"
              className="mt-2 w-28 text-nowrap lg:w-auto"
            >
              Max Replicas
            </Label>
            <div className="space-y-1">
              <Input
                value={autoscaler?.maxReplicas ?? ''}
                onChange={(event) =>
                  handleMaxReplicasChange(event.target.value)
                }
                type="number"
                id="maxReplicas"
                placeholder="10"
                disabled={!autoscalerEnabled}
                className={cn('max-w-28', {
                  'border-destructive': errors.autoscaler?.maxReplicas,
                })}
                aria-invalid={!!errors.autoscaler?.maxReplicas}
                onWheel={(event) => (event.target as HTMLInputElement).blur()}
                autoComplete="off"
                min={0}
              />
              {errors.autoscaler?.maxReplicas?.message && (
                <p className="text-destructive text-sm">
                  {errors.autoscaler.maxReplicas.message}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3">
          <Switch
            checked={autoscalerEnabled}
            onCheckedChange={toggleAutoscalerEnabled}
            className="self-center"
          />
          <span>Autoscaler</span>
          <InfoTooltip>
            Enable autoscaler to automatically provision extra run service
            replicas when needed.
          </InfoTooltip>
        </div>
      </div>
    </div>
  );
}
