import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { FormDescription, FormItem, FormLabel } from '@/components/ui/v3/form';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { Textarea } from '@/components/ui/v3/textarea';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useTestWebhookTransformQuery } from '@/features/orgs/projects/events/event-triggers/hooks/useTestWebhookTransformQuery';
import buildTestWebhookTransformDTO from '@/features/orgs/projects/events/event-triggers/utils/buildTestWebhookTransformDTO/buildTestWebhookTransformDTO';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import debounce from 'lodash.debounce';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function TransformedRequestBody() {
  const form = useFormContext<BaseEventTriggerFormValues>();
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
    } as BaseEventTriggerFormValues;

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

  const { data, isLoading, error } = useTestWebhookTransformQuery(
    debouncedArgs,
    {
      queryOptions: {
        enabled: !buildArgsError,
      },
    },
  );

  const canRun = Boolean(debouncedArgs.webhook_url) && !buildArgsError;

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
      {canRun && isLoading && (
        <Skeleton className="h-[250px] w-full max-w-lg" />
      )}
      {!buildArgsError && error && (
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Error with webhook handler</AlertTitle>
          <AlertDescription>{error.error}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !error && canRun && (
        <Textarea
          className="min-h-[250px] max-w-lg font-mono text-foreground"
          value={JSON.stringify(data?.body, null, 2)}
          disabled
        />
      )}
    </FormItem>
  );
}
