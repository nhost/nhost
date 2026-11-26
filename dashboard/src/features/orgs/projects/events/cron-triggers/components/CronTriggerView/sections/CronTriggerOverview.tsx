import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import { HeadersTable } from '@/features/orgs/projects/events/common/components/HeadersTable';
import { isNotEmptyValue } from '@/lib/utils';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';

export default function CronTriggerOverview({
  cronTrigger,
}: {
  cronTrigger: CronTrigger;
}) {
  const queryParams = cronTrigger.request_transform?.query_params;
  let queryParamsDisplay = '';
  if (typeof queryParams === 'string') {
    queryParamsDisplay = queryParams;
  } else if (queryParams) {
    queryParamsDisplay = Object.entries(queryParams)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
  }

  const bodyTransform = cronTrigger.request_transform?.body;
  let bodyTransformDisplay = '';
  if (typeof bodyTransform === 'string') {
    bodyTransformDisplay = bodyTransform;
  } else if (bodyTransform) {
    bodyTransformDisplay = Object.entries(bodyTransform.form_template ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Schedule</h3>
          <p className="font-mono text-lg">{cronTrigger.schedule}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {describeCronSchedule(cronTrigger.schedule)}, in UTC
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium text-foreground">Webhook</h3>
          <div className="text-sm">
            <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
              <span>{cronTrigger.webhook}</span>
              <CopyToClipboardButton
                textToCopy={cronTrigger.webhook}
                title="Webhook URL"
              />
            </div>
          </div>
        </div>
      </div>

      {cronTrigger.retry_conf && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium text-foreground">Retries</h3>
          <div className="grid gap-4 text-sm lg:grid-cols-4">
            <div>
              <div className="font-medium text-foreground">
                {cronTrigger.retry_conf.num_retries}
              </div>
              <div className="text-muted-foreground">Max retries</div>
            </div>
            <div>
              <div className="font-medium text-foreground">
                {cronTrigger.retry_conf.retry_interval_seconds}s
              </div>
              <div className="text-muted-foreground">Interval</div>
            </div>
            <div>
              <div className="font-medium text-foreground">
                {cronTrigger.retry_conf.timeout_seconds}s
              </div>
              <div className="text-muted-foreground">Timeout</div>
            </div>
            <div>
              <div className="font-medium text-foreground">
                {cronTrigger.retry_conf.tolerance_seconds}s
              </div>
              <div className="text-muted-foreground">Tolerance</div>
            </div>
          </div>
        </div>
      )}
      {cronTrigger.payload && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium text-foreground">Payload</h3>
          <div className="text-sm">
            <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
              <span>{JSON.stringify(cronTrigger.payload, null, 2)}</span>
            </div>
          </div>
        </div>
      )}

      {cronTrigger.comment && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Comment</h3>
          <p className="text-sm">{cronTrigger.comment}</p>
        </section>
      )}
      {isNotEmptyValue(cronTrigger.headers) && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Request headers</h3>
          <HeadersTable headers={cronTrigger.headers} />
        </section>
      )}
      {cronTrigger.request_transform && (
        <section className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">Request transform</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {cronTrigger.request_transform?.method && (
              <div>
                <span className="text-muted-foreground">Method: </span>
                <span className="font-mono text-foreground">
                  {cronTrigger.request_transform.method}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Template Engine: </span>
              <span className="font-mono text-foreground">
                {cronTrigger.request_transform?.template_engine}
              </span>
            </div>
          </div>

          {cronTrigger.request_transform?.url && (
            <div className="text-sm">
              <div className="mb-1 font-medium text-foreground">
                URL Template:
              </div>
              <div className="rounded p-2 font-mono text-foreground text-xs">
                {cronTrigger.request_transform?.url}
              </div>
            </div>
          )}

          {queryParamsDisplay && (
            <div className="text-sm">
              <div className="mb-1 font-medium text-foreground">
                Query Parameters:
              </div>
              <div className="rounded p-2 font-mono text-foreground text-xs">
                {queryParamsDisplay}
              </div>
            </div>
          )}

          {bodyTransformDisplay && (
            <div className="text-sm">
              <div className="mb-1 font-medium text-foreground">
                Body Template:
              </div>
              <div className="whitespace-pre-wrap rounded bg-muted p-2 font-mono text-foreground text-xs">
                {bodyTransformDisplay}
              </div>
            </div>
          )}

          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              Action:{' '}
              {typeof cronTrigger.request_transform.body === 'object'
                ? cronTrigger.request_transform.body?.action
                : 'N/A'}
            </span>
            <span>Version: {cronTrigger.request_transform.version}</span>
          </div>
        </section>
      )}
    </div>
  );
}
