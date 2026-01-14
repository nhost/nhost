import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { useTestWebhookTransformQuery } from '@/features/orgs/projects/events/common/hooks/useTestWebhookTransformQuery';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import buildTestWebhookTransformDTO from '@/features/orgs/projects/events/event-triggers/utils/buildTestWebhookTransformDTO/buildTestWebhookTransformDTO';
import { isEmptyValue } from '@/lib/utils';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import debounce from 'lodash.debounce';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function RequestURLTransformPreview() {
  const form = useFormContext<BaseEventTriggerFormValues>();
  const values = form.watch();
  const args = buildTestWebhookTransformDTO({ formValues: values });

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

  const { data, isLoading, error } =
    useTestWebhookTransformQuery(debouncedArgs);

  const url = data?.webhook_url;

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground text-sm">
          URL transform preview
        </h3>
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Validation failed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isEmptyValue(values.webhook) || error) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground text-sm">
          URL transform preview
        </h3>
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Error with webhook handler</AlertTitle>
          <AlertDescription>
            Please configure your webhook handler to generate request url
            transform
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || isEmptyValue(url)) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground text-sm">
          URL transform preview (loading...)
        </h3>
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-foreground text-sm">
        URL transform preview
      </h3>
      <p className="max-w-lg rounded-md bg-muted-foreground/10 p-2 font-mono text-muted-foreground text-sm dark:bg-muted">
        {url}
      </p>
    </div>
  );
}
