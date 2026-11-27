import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Pause,
  Pencil,
  Play,
} from 'lucide-react';
import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { Tabs, TabsContent } from '@/components/ui/v3/tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import ScheduleFields from '@/features/orgs/projects/events/common/components/ScheduleFields';
import CronJobPaneHeader from '@/features/orgs/projects/events/cron-jobs/components/CronJobPaneHeader';
import {
  CronJobPaneTab,
  CronJobPaneTabs,
} from '@/features/orgs/projects/events/cron-jobs/components/CronJobPaneTabs';
import DeleteJobButton from '@/features/orgs/projects/events/cron-jobs/components/DeleteJobButton';
import JobIconButton from '@/features/orgs/projects/events/cron-jobs/components/JobIconButton';
import type { SqlJobRunFilter } from '@/features/orgs/projects/events/sql-jobs/sql';
import {
  SQL_EDITOR_EXTENSIONS,
  SQL_EDITOR_SETUP,
} from '@/features/orgs/projects/events/sql-jobs/sql-editor';
import type {
  SqlJob,
  SqlJobRun,
} from '@/features/orgs/projects/events/sql-jobs/types';
import {
  useSqlJobRunCounts,
  useSqlJobRuns,
} from '@/features/orgs/projects/events/sql-jobs/use-sql-jobs';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';

const SQL_VIEWER_EXTENSIONS = [
  ...SQL_EDITOR_EXTENSIONS,
  codeMirrorAppBackground,
];
const SQL_VIEWER_SETUP = {
  ...SQL_EDITOR_SETUP,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
};

export function runTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export function RunStatus({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === 'failed'
          ? 'destructive'
          : status === 'succeeded'
            ? 'secondary'
            : 'outline'
      }
    >
      {status}
    </Badge>
  );
}

interface SqlJobDetailsProps {
  job: SqlJob;
  timezone: string;
  disabled: boolean;
  onEdit: VoidFunction;
  onToggle: VoidFunction;
  onDelete: VoidFunction;
  onConfigurePreload?: VoidFunction;
}

export default function SqlJobDetails({
  job,
  timezone,
  disabled,
  onEdit,
  onToggle,
  onDelete,
  onConfigurePreload,
}: SqlJobDetailsProps) {
  const { resolvedTheme } = useThemePreference();
  const isPlatform = useIsPlatform();
  const schedule = describeCronSchedule(job.schedule);
  const runCounts = useSqlJobRunCounts(job);
  const hasRuns = (runCounts.data?.all ?? 0) > 0;
  return (
    <Tabs defaultValue="overview" className="gap-0">
      <CronJobPaneHeader
        title={job.jobname ?? `Job ${job.jobid}`}
        actions={
          <>
            <JobIconButton
              label={job.active ? 'Pause job' : 'Resume job'}
              disabled={disabled}
              onClick={onToggle}
            >
              {job.active ? <Pause /> : <Play />}
            </JobIconButton>
            <JobIconButton
              label="Edit job"
              disabled={disabled}
              onClick={onEdit}
            >
              <Pencil />
            </JobIconButton>
            <DeleteJobButton disabled={disabled} onClick={onDelete} />
          </>
        }
      >
        {hasRuns && (
          <CronJobPaneTabs aria-label="Job details">
            <CronJobPaneTab value="overview">Overview</CronJobPaneTab>
            <CronJobPaneTab value="runs">Run history</CronJobPaneTab>
          </CronJobPaneTabs>
        )}
      </CronJobPaneHeader>
      <TabsContent value="overview" className="space-y-4 p-6">
        {onConfigurePreload && (
          <Alert variant="warning">
            <AlertTitle>pg_cron is not preloaded</AlertTitle>
            <AlertDescription>
              Jobs cannot run until Postgres preloads pg_cron.
              <Button
                className="ml-3"
                size="sm"
                variant="outline"
                onClick={onConfigurePreload}
              >
                Configure preload
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!job.active && (
          <Alert variant="warning">
            <AlertTitle>This job is paused</AlertTitle>
            <AlertDescription>
              It won't run on its schedule until you resume it.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border p-4">
            <h2 className="font-medium">Schedule</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {schedule}, in {timezone}
            </p>
            <ScheduleFields schedule={job.schedule} />
          </section>
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Details</h2>
            <VariableGroup>
              <DetailRow label="Database role" value={job.username} />
              <DetailRow label="Database" value={job.database} />
              <DetailRow label="Job ID" value={job.jobid} />
            </VariableGroup>
          </section>
        </div>
        <section className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-medium">SQL command</h2>
            <CopyToClipboardButton
              textToCopy={job.command}
              title="SQL command"
            />
          </div>
          <CodeMirror
            aria-label="SQL command"
            value={job.command}
            theme={resolvedTheme === 'light' ? githubLight : githubDark}
            extensions={SQL_VIEWER_EXTENSIONS}
            basicSetup={SQL_VIEWER_SETUP}
            readOnly
            editable={false}
            indentWithTab={false}
            className="overflow-hidden rounded-md border text-sm [&_.cm-scroller]:max-h-72"
          />
        </section>
        <p className="text-muted-foreground text-sm">
          {isPlatform
            ? 'Changes run directly against your database.'
            : 'Job and extension changes create Hasura migrations in your project.'}
        </p>
      </TabsContent>
      <TabsContent value="runs" className="p-6">
        <SqlJobRunHistory job={job} />
      </TabsContent>
    </Tabs>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow className="group">
      <TableCell>{label}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="min-w-0 break-all font-mono text-muted-foreground">
            {value}
          </span>
          <CopyToClipboardButton
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            textToCopy={value}
            title={label}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function RunStatusLabel({ status }: { status: string }) {
  if (status === 'succeeded') {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <CircleCheck className="size-4" />
        Succeeded
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <CircleX className="size-4" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Clock className="size-4" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function runDuration(run: SqlJobRun): string {
  if (!run.start_time || !run.end_time) {
    return '—';
  }
  const ms =
    new Date(run.end_time).getTime() - new Date(run.start_time).getTime();
  if (ms < 1000) {
    return `${ms} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  return `${Math.round(ms / 60_000)} min`;
}

function RunRow({ run }: { run: SqlJobRun }) {
  const [open, setOpen] = useState(false);
  const started = run.start_time ? new Date(run.start_time) : null;
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <TableCell className="w-8 pr-0">
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
        </TableCell>
        <TableCell>
          <RunStatusLabel status={run.status} />
        </TableCell>
        <TableCell>
          {started ? (
            <span className="whitespace-nowrap">
              {format(started, 'd MMM, HH:mm')}
              <span className="ml-2 text-muted-foreground text-xs">
                {formatDistanceToNowStrict(started, { addSuffix: true })}
              </span>
            </span>
          ) : (
            '—'
          )}
        </TableCell>
        <TableCell className="max-w-56 truncate font-mono text-muted-foreground text-xs">
          {run.return_message ?? '—'}
        </TableCell>
        <TableCell className="whitespace-nowrap font-mono text-xs">
          {runDuration(run)}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground text-xs">
          #{run.runid}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell />
          <TableCell colSpan={5} className="pb-4">
            <p className="mb-2 text-muted-foreground text-xs">Return message</p>
            <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/30 p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {run.return_message || 'No message'}
              </pre>
              <CopyToClipboardButton
                textToCopy={run.return_message}
                title="return message"
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const RUNS_PAGE_SIZE = 20;

const RUN_FILTERS: { value: SqlJobRunFilter; label: string }[] = [
  { value: 'all', label: 'All runs' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
];

function SqlJobRunHistory({ job }: { job: SqlJob }) {
  const [filter, setFilter] = useState<SqlJobRunFilter>('all');
  const [page, setPage] = useState(1);
  const offset = (page - 1) * RUNS_PAGE_SIZE;
  const runs = useSqlJobRuns(job, offset, RUNS_PAGE_SIZE, filter);
  const counts = useSqlJobRunCounts(job);
  if (counts.data?.failed === 0 && filter === 'failed') {
    setFilter('all');
    setPage(1);
  }
  const total = counts.data?.[filter] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RUNS_PAGE_SIZE));
  if (page > totalPages && counts.data) {
    setPage(totalPages);
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <Select
          value={filter}
          onValueChange={(value) => {
            setFilter(value as SqlJobRunFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Show runs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RUN_FILTERS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
                {counts.data ? (
                  <span className="ml-1.5 text-muted-foreground text-xs">
                    {counts.data[value]}
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-muted-foreground text-sm">
          Times in your time zone
        </p>
      </div>
      {runs.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load run history</AlertTitle>
          <AlertDescription>
            {runs.error instanceof Error
              ? runs.error.message
              : 'Run history will update automatically.'}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {runs.data?.length === 0 ? (
            <p className="rounded-lg border py-10 text-center text-muted-foreground text-sm">
              {filter === 'all'
                ? 'No recorded runs yet.'
                : `No ${filter} runs.`}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="[&_th]:text-foreground">
                  <TableRow>
                    <TableHead className="w-8 pr-0" />
                    <TableHead>Status</TableHead>
                    <TableHead aria-sort="descending">Started</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody aria-busy={runs.isLoading}>
                  {runs.isLoading
                    ? [1, 2, 3, 4].map((row) => (
                        <TableRow key={row}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : runs.data?.map((run) => (
                        <RunRow key={run.runid} run={run} />
                      ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <Pagination
              className="mt-4 flex-row-reverse"
              totalNrOfPages={totalPages}
              elementsPerPage={RUNS_PAGE_SIZE}
              totalNrOfElements={total}
              itemsLabel="runs"
              currentPageNumber={page}
              onPrevPageClick={() => setPage((value) => Math.max(1, value - 1))}
              onNextPageClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
