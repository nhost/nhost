import { FormInput } from '@/components/form/FormInput';
import { FormDescription } from '@/components/ui/v3/form';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useFormContext } from 'react-hook-form';

interface RetryConfigurationSectionProps {
  className?: string;
}

export default function RetryConfigurationSection({
  className,
}: RetryConfigurationSectionProps) {
  const form = useFormContext<BaseEventTriggerFormValues>();

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-base font-medium text-foreground">
          Retry Configuration
        </h3>
        <FormDescription>
          Configuration to retry the webhook in case of failure
        </FormDescription>
      </div>
      <div className="flex flex-col gap-8 text-foreground lg:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
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
        </div>
        <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2">
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
      </div>
    </div>
  );
}
