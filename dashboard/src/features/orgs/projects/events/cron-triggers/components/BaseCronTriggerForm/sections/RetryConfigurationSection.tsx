import { FormInput } from '@/components/form/FormInput';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
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
        <h3 className="font-medium text-base text-foreground">
          Retry Configuration
        </h3>
        <p className="text-muted-foreground text-sm">
          Configuration to retry the webhook in case of failure
        </p>
      </div>
      <div className="flex max-w-lg flex-col gap-8 text-foreground">
        <div className="flex flex-1 flex-row gap-6">
          <div className="flex flex-1 flex-col gap-2">
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
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.intervalSec"
              placeholder="retry interval (default: 10)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              label={
                <div className="flex flex-row items-center gap-2">
                  Retry interval (in seconds){' '}
                  <InfoTooltip>
                    Interval in seconds between each retry of the webhook
                  </InfoTooltip>
                </div>
              }
            />
          </div>
        </div>
        <div className="flex flex-1 flex-row gap-6">
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.timeoutSec"
              placeholder="timeout (default: 60)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              label={
                <div className="flex flex-row items-center gap-2">
                  Timeout (in seconds){' '}
                  <InfoTooltip>
                    Request timeout (in seconds) for the webhook
                  </InfoTooltip>
                </div>
              }
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <FormInput
              control={form.control}
              name="retryConf.toleranceSec"
              placeholder="tolerance (default: 21600)"
              type="number"
              className="text-foreground"
              autoComplete="off"
              label={
                <div className="flex flex-row items-center gap-2">
                  Tolerance (in seconds){' '}
                  <InfoTooltip>
                    Number of seconds between scheduled time and actual delivery
                    time that is acceptable
                  </InfoTooltip>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
