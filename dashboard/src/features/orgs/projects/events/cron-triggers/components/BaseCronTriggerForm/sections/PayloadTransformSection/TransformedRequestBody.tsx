import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { FormDescription, FormItem, FormLabel } from '@/components/ui/v3/form';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { Textarea } from '@/components/ui/v3/textarea';
import { useTestWebhookTransformQuery } from '@/features/orgs/projects/events/common/hooks/useTestWebhookTransformQuery';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { buildTestWebhookTransformDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildTestWebhookTransformDTO';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import debounce from 'lodash.debounce';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function TransformedRequestBody() {
  const form = useFormContext<BaseCronTriggerFormValues>();
  const values = form.watch();

  let args: TestWebhookTransformArgs;
  let buildArgsError: string | null = null;

  try {
    args = buildTestWebhookTransformDTO({ formValues: values });
  } catch (err) {
    buildArgsError =
      err instanceof Error
        ? err.message
        : 'Invalid sample input. Please enter a valid JSON string.';

    const sanitizedValues = {
      ...values,
      payloadTransform: {
        ...(values.payloadTransform ?? {}),
        sampleInput: '{}',
      },
    } as BaseCronTriggerFormValues;

    args = buildTestWebhookTransformDTO({
      formValues: sanitizedValues,
    });
  }

  const [debouncedArgs, setDebouncedArgs] =
    useState<TestWebhookTransformArgs>(args);

  const debouncedSetArgs = useMemo(
    () =>
      debounce((nextArgs: TestWebhookTransformArgs) => {
        setDebouncedArgs(nextArgs);
      }, 500),
    [],
  );

  useEffect(() => {
    debouncedSetArgs(args);
    return () => debouncedSetArgs.cancel();
  }, [args, debouncedSetArgs]);

  const { data, isFetching, error } = useTestWebhookTransformQuery(
    debouncedArgs,
    {
      queryOptions: {
        enabled: !buildArgsError,
      },
    },
  );

  const canRun = Boolean(debouncedArgs.webhook_url) && !buildArgsError;
  const requestBody = data?.body ? JSON.stringify(data.body, null, 2) : '';
  const showLoadingOverlay = canRun && isFetching && !error;

  return (
    <FormItem>
      <FormLabel className="text-foreground">
        Transformed Request Body
      </FormLabel>
      <FormDescription>
        Sample request body to be delivered based on your input and
        transformation template.
      </FormDescription>
      {buildArgsError && (
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Invalid sample input</AlertTitle>
          <AlertDescription>{buildArgsError}</AlertDescription>
        </Alert>
      )}
      {!canRun && (
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Webhook URL not configured</AlertTitle>
          <AlertDescription>
            Please configure your webhook URL to generate request body transform
          </AlertDescription>
        </Alert>
      )}
      {canRun && (
        <div className="relative w-full max-w-lg">
          <Textarea
            className="min-h-[250px] w-full font-mono text-foreground"
            value={requestBody}
            disabled
          />
          {showLoadingOverlay && (
            <Skeleton className="pointer-events-none absolute inset-px h-full w-full rounded-[5px] opacity-50" />
          )}
          {!buildArgsError && error && (
            <div className="absolute inset-px space-y-1 rounded-[5px] bg-background/80 p-2 backdrop-blur-sm">
              <p className="font-medium text-destructive text-sm">
                {error.error || 'Error with webhook handler'}
              </p>
              <p className="text-destructive/90 text-sm">
                Failed to transform webhook request body.
              </p>
            </div>
          )}
        </div>
      )}
    </FormItem>
  );
}
