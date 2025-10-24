import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/v3/field';
import { Input } from '@/components/ui/v3/input';
import { IconTooltip } from '@/features/orgs/projects/common/components/IconTooltip';
import { Controller, useFormContext } from 'react-hook-form';
import { CreateEventTriggerFormValues } from '../CreateEventTriggerForm';

export default function RetryConfigurationSection() {
  const form = useFormContext<CreateEventTriggerFormValues>();

  return (
    <FieldSet>
      <FieldLegend className="text-foreground">Retry Configuration</FieldLegend>
      <FieldDescription>
        Configuration to retry the webhook in case of failure
      </FieldDescription>
      <FieldGroup className="flex flex-col gap-8 lg:flex-row">
        <Controller
          name="retryConf.numRetries"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex flex-row items-center gap-2">
                <FieldLabel htmlFor="numRetries" className="text-foreground">
                  Number of Retries
                </FieldLabel>
                <FieldDescription>
                  <IconTooltip>
                    Number of retries that Hasura makes to the webhook in case
                    of failure
                  </IconTooltip>
                </FieldDescription>
              </div>
              <Input
                {...field}
                id="numRetries"
                aria-invalid={fieldState.invalid}
                placeholder="0"
                type="number"
                min="0"
                className="text-foreground"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="retryConf.intervalSec"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex flex-row items-center gap-2">
                <FieldLabel htmlFor="intervalSec" className="text-foreground">
                  Retry interval (in seconds)
                </FieldLabel>
                <FieldDescription>
                  <IconTooltip>
                    Interval in seconds between each retry of the webhook
                  </IconTooltip>
                </FieldDescription>
              </div>
              <Input
                {...field}
                id="intervalSec"
                aria-invalid={fieldState.invalid}
                placeholder="10"
                type="number"
                min="0"
                className="text-foreground"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="retryConf.timeoutSec"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex flex-row items-center gap-2">
                <FieldLabel htmlFor="timeoutSec" className="text-foreground">
                  Timeout (in seconds)
                </FieldLabel>
                <FieldDescription>
                  <IconTooltip>
                    Request timeout (in seconds) for the webhook
                  </IconTooltip>
                </FieldDescription>
              </div>
              <Input
                {...field}
                id="timeoutSec"
                aria-invalid={fieldState.invalid}
                placeholder="10"
                type="number"
                min="0"
                className="text-foreground"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </FieldSet>
  );
}
