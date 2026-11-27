import { StreamLanguage } from '@codemirror/language';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import ScheduleFields from '@/features/orgs/projects/events/common/components/ScheduleFields';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import { isHeaderWithEnvValue } from '@/utils/hasura-api/guards';

function formatSeconds(value?: number | null): string {
  if (value == null) {
    return 'Default';
  }
  const units: [number, string][] = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    if (value >= size && value % size === 0) {
      const count = value / size;
      return `${count} ${unit}${count === 1 ? '' : 's'}`;
    }
  }
  return `${value} second${value === 1 ? '' : 's'}`;
}

function TransformRow({
  label,
  value,
  plain,
}: {
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell
        className={cn('break-all text-muted-foreground', !plain && 'font-mono')}
      >
        {value}
      </TableCell>
    </TableRow>
  );
}

function describeRetries(
  retries?: number | null,
  interval?: number | null,
): string {
  if (!retries) {
    return 'None';
  }
  const times = `${retries} time${retries === 1 ? '' : 's'}`;
  return `${times}, ${formatSeconds(interval)} apart`;
}

const payloadExtensions = [
  StreamLanguage.define(json),
  codeMirrorAppBackground,
];

export default function CronTriggerOverview({
  cronTrigger,
}: {
  cronTrigger: CronTrigger;
}) {
  const { resolvedTheme } = useThemePreference();
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
  } else if (bodyTransform?.template) {
    bodyTransformDisplay = bodyTransform.template;
  } else if (bodyTransform) {
    bodyTransformDisplay = Object.entries(bodyTransform.form_template ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Schedule</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {describeCronSchedule(cronTrigger.schedule)}, in UTC
          </p>
          <ScheduleFields schedule={cronTrigger.schedule} />
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
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Delivery</h3>
          <VariableGroup>
            <TableRow>
              <TableCell>Retries</TableCell>
              <TableCell className="text-muted-foreground">
                {describeRetries(
                  cronTrigger.retry_conf.num_retries,
                  cronTrigger.retry_conf.retry_interval_seconds,
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Timeout</TableCell>
              <TableCell className="text-muted-foreground">
                {formatSeconds(cronTrigger.retry_conf.timeout_seconds)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Tolerance</TableCell>
              <TableCell className="text-muted-foreground">
                {formatSeconds(cronTrigger.retry_conf.tolerance_seconds)}
              </TableCell>
            </TableRow>
          </VariableGroup>
        </section>
      )}
      {isNotEmptyValue(cronTrigger.headers) && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Request headers</h3>
          <VariableGroup>
            {cronTrigger.headers?.map((header) => (
              <TableRow key={header.name}>
                <TableCell className="break-all font-mono">
                  {header.name}
                </TableCell>
                <TableCell className="break-all text-muted-foreground">
                  {isHeaderWithEnvValue(header) ? (
                    <>
                      <span className="font-mono">{header.value_from_env}</span>
                      <span className="ml-2 text-xs">env var</span>
                    </>
                  ) : (
                    <span className="font-mono">{header.value}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </VariableGroup>
        </section>
      )}
      {cronTrigger.payload != null && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Payload</h3>
          <CodeMirror
            aria-label="Webhook payload"
            value={JSON.stringify(cronTrigger.payload, null, 2)}
            theme={resolvedTheme === 'light' ? githubLight : githubDark}
            extensions={payloadExtensions}
            basicSetup={{
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              foldGutter: false,
            }}
            readOnly
            editable={false}
            indentWithTab={false}
            className="overflow-hidden rounded-md border text-sm [&_.cm-scroller]:max-h-72"
          />
        </section>
      )}
      {cronTrigger.request_transform && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Request transform</h3>
          <VariableGroup>
            {cronTrigger.request_transform.method && (
              <TransformRow
                label="Method"
                value={cronTrigger.request_transform.method}
              />
            )}
            {cronTrigger.request_transform.url && (
              <TransformRow
                label="URL template"
                value={cronTrigger.request_transform.url}
              />
            )}
            {queryParamsDisplay && (
              <TransformRow
                label="Query parameters"
                value={queryParamsDisplay}
              />
            )}
            {typeof cronTrigger.request_transform.body === 'object' &&
              cronTrigger.request_transform.body?.action && (
                <TransformRow
                  label="Body"
                  value={
                    cronTrigger.request_transform.body.action === 'transform'
                      ? 'Transformed'
                      : cronTrigger.request_transform.body.action
                  }
                  plain
                />
              )}
          </VariableGroup>
          {bodyTransformDisplay && (
            <div className="mt-4">
              <p className="mb-2 text-muted-foreground text-xs">
                Body template
              </p>
              <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {bodyTransformDisplay}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
