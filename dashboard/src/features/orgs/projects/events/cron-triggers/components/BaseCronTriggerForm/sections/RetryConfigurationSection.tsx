import { FormInput } from '@/components/form/FormInput';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useFormContext } from 'react-hook-form';

interface RetryConfigurationSectionProps {
  className?: string;
}

export default function RetryConfigurationSection({
  className,
}: RetryConfigurationSectionProps) {
  const form = useFormContext<BaseCronTriggerFormValues>();

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-base font-medium text-foreground">
          Retry Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Configuration to retry the webhook in case of failure
        </p>
      </div>
      <div className="flex max-w-lg flex-col gap-8 text-foreground">
        <div className="flex flex-1 flex-row gap-6">
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.numRetries"
              label="Number of Retries"
              placeholder="number of retries (default: 0)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              infoTooltip="Number of retries that Hasura makes to the webhook in case of failure"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.intervalSec"
              label="Retry interval (in seconds)"
              placeholder="retry interval (default: 10)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              infoTooltip="Interval in seconds between each retry of the webhook"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-row gap-6">
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.timeoutSec"
              label="Timeout (in seconds)"
              placeholder="timeout (default: 60)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              infoTooltip="Request timeout (in seconds) for the webhook"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.toleranceSec"
              label="Tolerance (in seconds)"
              placeholder="tolerance (default: 21600)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              infoTooltip="Number of seconds between scheduled time and actual delivery time that is acceptable"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
