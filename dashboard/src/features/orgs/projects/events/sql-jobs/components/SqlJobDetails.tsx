import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { ArrowDown, Pause, Pencil, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import CronJobPaneHeader from '@/features/orgs/projects/events/cron-jobs/components/CronJobPaneHeader';
import DeleteJobButton from '@/features/orgs/projects/events/cron-jobs/components/DeleteJobButton';
import JobIconButton from '@/features/orgs/projects/events/cron-jobs/components/JobIconButton';
import SidebarIconAction from '@/features/orgs/projects/events/cron-jobs/components/SidebarIconAction';
import {
  SQL_EDITOR_EXTENSIONS,
  SQL_EDITOR_SETUP,
} from '@/features/orgs/projects/events/sql-jobs/sql-editor';
import type { SqlJob } from '@/features/orgs/projects/events/sql-jobs/types';
import { useSqlJobRuns } from '@/features/orgs/projects/events/sql-jobs/use-sql-jobs';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
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
  return (
    <Tabs defaultValue="overview" className="gap-0">
      <CronJobPaneHeader
        title={job.jobname ?? `Job ${job.jobid}`}
        subtitle={`SQL job · ${schedule}`}
        paused={!job.active}
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
        </TabsList>
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
            <h2 className="mb-3 font-medium">Schedule</h2>
            <p className="font-mono text-lg">{job.schedule}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              {schedule}, in {timezone}
            </p>
          </section>
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">State</dt>
                <dd>{job.active ? 'Enabled' : 'Paused'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Database role</dt>
                <dd>{job.username}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Database</dt>
                <dd>{job.database}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Job ID</dt>
                <dd>{job.jobid}</dd>
              </div>
            </dl>
          </section>
        </div>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">SQL command</h2>
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

function SqlJobRunHistory({ job }: { job: SqlJob }) {
  const [offset, setOffset] = useState(0);
  const pageSize = 20;
  const runs = useSqlJobRuns(job, offset, pageSize + 1);
  if (offset > 0 && runs.data?.length === 0 && !runs.isFetching) {
    setOffset(0);
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Times in your browser&apos;s time zone
        </p>
        <SidebarIconAction
          label="Refresh"
          disabled={runs.isFetching}
          onClick={() => runs.refetch()}
        >
          <RefreshCw />
        </SidebarIconAction>
      </div>
      {runs.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load run history</AlertTitle>
          <AlertDescription>
            {runs.error instanceof Error
              ? runs.error.message
              : 'Try refreshing run history.'}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead aria-sort="descending">
                    <span className="inline-flex items-center gap-1">
                      Started
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </span>
                  </TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody aria-busy={runs.isLoading}>
                {runs.isLoading
                  ? [1, 2, 3, 4].map((row) => (
                      <TableRow key={row}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : runs.data?.slice(0, pageSize).map((run) => (
                      <TableRow key={run.runid}>
                        <TableCell className="font-mono">{run.runid}</TableCell>
                        <TableCell>
                          <RunStatus status={run.status} />
                        </TableCell>
                        <TableCell>{runTime(run.start_time)}</TableCell>
                        <TableCell>{runTime(run.end_time)}</TableCell>
                        <TableCell className="max-w-xs whitespace-pre-wrap break-words">
                          {run.return_message ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          {runs.data?.length === 0 && (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No recorded runs yet.
            </p>
          )}
          {!runs.isLoading && Boolean(runs.data?.length) && (
            <div className="mt-4 flex items-center justify-end gap-3">
              <span className="text-muted-foreground text-sm">
                Page {Math.floor(offset / pageSize) + 1}
              </span>
              <Button
                variant="outline"
                disabled={offset === 0 || runs.isFetching}
                onClick={() => setOffset((value) => value - pageSize)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={
                  (runs.data?.length ?? 0) <= pageSize || runs.isFetching
                }
                onClick={() => setOffset((value) => value + pageSize)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
