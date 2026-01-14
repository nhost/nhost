import { Skeleton } from '@/components/ui/v3/skeleton';
import { useTestWebhookTransformQuery } from '@/features/orgs/projects/events/common/hooks/useTestWebhookTransformQuery';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { buildTestWebhookTransformDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildTestWebhookTransformDTO';
import { isEmptyValue } from '@/lib/utils';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import debounce from 'lodash.debounce';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

export default function RequestURLTransformPreview() {
  const form = useFormContext<BaseCronTriggerFormValues>();
  const formValues = form.watch();
  const { args, argsError } = useMemo(() => {
    try {
      return {
        args: buildTestWebhookTransformDTO({ formValues }),
        argsError: null,
      };
    } catch (err) {
      return {
        args: {
          webhook_url: '',
          body: {},
          env: {},
          request_transform: {},
          session_variables: {},
        } satisfies TestWebhookTransformArgs,
        argsError:
          err instanceof Error
            ? err
            : new Error('Failed to build test webhook transform arguments.'),
      };
    }
  }, [formValues]);

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
        enabled: !argsError,
      },
    },
  );

  const url = data?.webhook_url;
  const canRun = !argsError && !isEmptyValue(formValues.webhook);
  const showLoading = canRun && isLoading && !error;

  let errorMessage: string | null = null;
  if (argsError) {
    errorMessage = argsError.message;
  } else if (error) {
    errorMessage = error.message || 'Validation failed';
  } else if (isEmptyValue(formValues.webhook)) {
    errorMessage =
      'Please configure your webhook handler to generate request URL transform';
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-foreground text-sm">
        URL transform preview
        {showLoading ? ' (loading...)' : ''}
      </h3>
      <div className="relative max-w-lg">
        <p className="rounded-md bg-muted-foreground/10 p-2 font-mono text-muted-foreground text-sm dark:bg-muted">
          {url || '\u00A0'}
        </p>
        {showLoading && (
          <Skeleton className="pointer-events-none absolute inset-px h-full w-full rounded-[5px] opacity-50" />
        )}
        {errorMessage && (
          <div className="absolute inset-px flex items-center rounded-[5px] bg-background/90 px-2 backdrop-blur-sm">
            <p className="text-destructive text-sm">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
