import { FormInput } from '@/components/form/FormInput';
import { FormDescription } from '@/components/ui/v3/form';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
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
        <h3 className="font-medium text-base text-foreground">
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
              placeholder="number of retries (default: 0)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              label={
                <div className="flex flex-row items-center gap-2">
                  Number of Retries{' '}
                  <InfoTooltip>
                    Number of retries that Hasura makes to the webhook in case
                    of failure
                  </InfoTooltip>
                </div>
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <FormInput
            control={form.control}
            name="retryConf.intervalSec"
            label={
              <div className="flex flex-row items-center gap-2">
                Retry interval (in seconds){' '}
                <InfoTooltip>
                  Interval in seconds between each retry of the webhook
                </InfoTooltip>
              </div>
            }
            placeholder="retry interval (default: 10)"
            type="number"
            className="text-foreground"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormInput
            control={form.control}
            name="retryConf.timeoutSec"
            label={
              <div className="flex flex-row items-center gap-2">
                Timeout (in seconds){' '}
                <InfoTooltip>
                  Request timeout (in seconds) for the webhook
                </InfoTooltip>
              </div>
            }
            placeholder="timeout (default: 60)"
            type="number"
            className="text-foreground"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
