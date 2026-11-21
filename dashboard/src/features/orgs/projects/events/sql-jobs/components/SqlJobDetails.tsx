import { ArrowDown } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { SqlJob } from '@/features/orgs/projects/events/sql-jobs/types';
import { useSqlJobRuns } from '@/features/orgs/projects/events/sql-jobs/use-sql-jobs';

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

export default function SqlJobDetails({
  job,
  onClose,
}: {
  job: SqlJob;
  onClose: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const pageSize = 20;
  const runs = useSqlJobRuns(job, offset, pageSize + 1);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent showOverlay className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader className="mb-6 pr-8">
          <SheetTitle>{job.jobname ?? `Job ${job.jobid}`}</SheetTitle>
          <SheetDescription>
            SQL job configuration and execution history. Times are shown in your
            browser's timezone.
          </SheetDescription>
        </SheetHeader>
        <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Schedule</dt>
            <dd className="font-mono">{job.schedule}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">State</dt>
            <dd>{job.active ? 'Enabled' : 'Disabled'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Database</dt>
            <dd>{job.database}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Database role</dt>
            <dd>{job.username}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Connection</dt>
            <dd>
              {job.nodename}:{job.nodeport}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job ID</dt>
            <dd>{job.jobid}</dd>
          </div>
        </dl>
        <h3 className="mb-2 font-semibold">SQL command</h3>
        <pre className="mb-6 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-4 text-sm">
          {job.command}
        </pre>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="font-semibold">Run history</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={runs.isFetching}
            onClick={() => runs.refetch()}
          >
            Refresh history
          </Button>
        </div>
        {runs.error instanceof Error ? (
          <Alert variant="destructive">
            <AlertDescription>{runs.error.message}</AlertDescription>
          </Alert>
        ) : runs.isLoading ? (
          <Spinner />
        ) : (
          <>
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
              <TableBody>
                {runs.data?.slice(0, pageSize).map((run) => (
                  <TableRow key={run.runid}>
                    <TableCell>{run.runid}</TableCell>
                    <TableCell>
                      <RunStatus status={run.status} />
                    </TableCell>
                    <TableCell>{runTime(run.start_time)}</TableCell>
                    <TableCell>{runTime(run.end_time)}</TableCell>
                    <TableCell className="max-w-sm whitespace-pre-wrap break-words">
                      {run.return_message ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {runs.data?.length === 0 && (
              <p className="py-6 text-muted-foreground text-sm">
                No recorded runs. This job may not have run yet, run logging may
                be disabled, or its history may have been removed.
              </p>
            )}
          </>
        )}
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
              !runs.data ||
              runs.data.length <= pageSize ||
              runs.isFetching ||
              runs.isError
            }
            onClick={() => setOffset((value) => value + pageSize)}
          >
            Next
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
