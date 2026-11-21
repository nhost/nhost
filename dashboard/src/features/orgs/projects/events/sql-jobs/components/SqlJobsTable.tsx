import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  RunStatus,
  runTime,
} from '@/features/orgs/projects/events/sql-jobs/components/SqlJobDetails';
import type { SqlJob } from '@/features/orgs/projects/events/sql-jobs/types';

interface SqlJobsTableProps {
  jobs: SqlJob[];
  disabled: boolean;
  onView: (job: SqlJob) => void;
  onEdit: (job: SqlJob) => void;
  onToggle: (job: SqlJob) => void;
  onDelete: (job: SqlJob) => void;
}

export default function SqlJobsTable({
  jobs,
  disabled,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: SqlJobsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Database / Role</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const name = job.jobname ?? `Job ${job.jobid}`;
          return (
            <TableRow key={job.jobid}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto max-w-xs justify-start whitespace-normal break-all p-0 text-left"
                  onClick={() => onView(job)}
                >
                  {name}
                </Button>
              </TableCell>
              <TableCell className="font-mono">{job.schedule}</TableCell>
              <TableCell>
                <div>{job.database}</div>
                <div className="text-muted-foreground text-xs">
                  {job.username}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={job.active ? 'secondary' : 'outline'}>
                  {job.active ? 'Enabled' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell>
                {job.lastRun ? (
                  <div className="space-y-1">
                    <RunStatus status={job.lastRun.status} />
                    <div className="text-muted-foreground text-xs">
                      {runTime(job.lastRun.start_time)}
                    </div>
                  </div>
                ) : (
                  'No recorded runs'
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`${job.active ? 'Disable' : 'Enable'} ${name}`}
                    onClick={() => onToggle(job)}
                  >
                    {job.active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Edit ${name}`}
                    onClick={() => onEdit(job)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Delete ${name}`}
                    onClick={() => onDelete(job)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
