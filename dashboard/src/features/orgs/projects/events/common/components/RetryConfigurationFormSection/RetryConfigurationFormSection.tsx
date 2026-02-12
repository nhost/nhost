import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

interface RetryConfigurationFormSectionProps {
  showToleranceSec?: boolean;
}

export default function RetryConfigurationFormSection({
  showToleranceSec,
}: RetryConfigurationFormSectionProps) {
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-6 pl-4">
      <div className="space-y-2">
        <h3 className="font-medium text-base text-foreground">
          Retry Configuration
        </h3>
        <p className="text-muted-foreground text-sm">
          Configuration to retry the webhook in case of failure
        </p>
      </div>
      <div
        className={
          showToleranceSec
            ? 'grid max-w-lg grid-cols-2 gap-6 text-foreground'
            : 'flex flex-col gap-8 text-foreground lg:flex-row'
        }
      >
        <FormInput
          control={control}
          name="retryConf.numRetries"
          placeholder="number of retries (default: 0)"
          type="number"
          className="text-foreground"
          autoComplete="off"
          label={
            <div className="flex flex-row items-center gap-2">
              Number of Retries{' '}
              <InfoTooltip>
                Number of retries that Hasura makes to the webhook in case of
                failure
              </InfoTooltip>
            </div>
          }
        />
        <FormInput
          control={control}
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
        <FormInput
          control={control}
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
        {showToleranceSec && (
          <FormInput
            control={control}
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
        )}
      </div>
    </div>
  );
}
