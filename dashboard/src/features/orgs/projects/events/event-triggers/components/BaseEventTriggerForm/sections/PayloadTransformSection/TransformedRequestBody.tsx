import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/v3/field';
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
  const args = buildTestWebhookTransformDTO({ formValues: values });

  const [debouncedArgs, setDebouncedArgs] =
    useState<TestWebhookTransformArgs>(args);

  const debouncedSetArgs = useMemo(
    () =>
      debounce((nextArgs: TestWebhookTransformArgs) => {
        setDebouncedArgs(nextArgs);
      }, 2000),
    [],
  );

  useEffect(() => {
    debouncedSetArgs(args);
    return () => debouncedSetArgs.cancel();
  }, [args, debouncedSetArgs]);

  const { data, isLoading, error } =
    useTestWebhookTransformQuery(debouncedArgs);

  const canRun = Boolean(debouncedArgs.webhook_url);

  return (
    <Field>
      <FieldLabel className="text-foreground">
        Transformed Request Body
      </FieldLabel>
      <FieldDescription>
        Sample request body to be delivered based on your input and
        transformation template.
      </FieldDescription>
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
      {error && (
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Error with webhook handler</AlertTitle>
          <AlertDescription>{error.error}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !error && (
        <Textarea
          className="min-h-[250px] max-w-lg font-mono text-foreground"
          value={JSON.stringify(data?.body, null, 2)}
          disabled
        />
      )}
    </Field>
  );
}
