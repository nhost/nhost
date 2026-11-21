import { Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Badge } from '@/components/ui/v3/badge';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { InstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/InstallExtensionDialog';
import { PreloadExtensionDialog } from '@/features/orgs/projects/database/extensions/components/PreloadExtensionDialog';
import { usePostgresExtensionsQuery } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePreloadedLibrariesQuery } from '@/features/orgs/projects/database/extensions/hooks/usePreloadedLibrariesQuery';
import { SQL_JOBS_DATA_SOURCE } from '@/features/orgs/projects/events/sql-jobs/api';
import CronSettings from '@/features/orgs/projects/events/sql-jobs/components/CronSettings';
import SqlJobDetails from '@/features/orgs/projects/events/sql-jobs/components/SqlJobDetails';
import SqlJobForm from '@/features/orgs/projects/events/sql-jobs/components/SqlJobForm';
import SqlJobsTable from '@/features/orgs/projects/events/sql-jobs/components/SqlJobsTable';
import {
  deleteSqlJobChange,
  disableCronChange,
  setSqlJobActiveChange,
} from '@/features/orgs/projects/events/sql-jobs/sql';
import type {
  SqlJob,
  SqlJobChange,
  SqlJobValues,
} from '@/features/orgs/projects/events/sql-jobs/types';
import {
  useCronState,
  useSqlJobMutation,
  useSqlJobs,
} from '@/features/orgs/projects/events/sql-jobs/use-sql-jobs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface Confirmation {
  title: string;
  description: string;
  label: string;
  change: SqlJobChange;
}

export default function SqlJobs() {
  const isPlatform = useIsPlatform();
  const catalog = usePostgresExtensionsQuery(SQL_JOBS_DATA_SOURCE);
  const running = usePreloadedLibrariesQuery(SQL_JOBS_DATA_SOURCE);
  const state = useCronState();
  const extension = catalog.data?.find(({ name }) => name === 'pg_cron');
  const installed = Boolean(extension?.installed_version);
  const preloaded = running.data?.includes('pg_cron') ?? false;
  const jobs = useSqlJobs(installed);
  const mutation = useSqlJobMutation();
  const [extensionDialog, setExtensionDialog] = useState<
    'install' | 'preload' | null
  >(null);
  const [form, setForm] = useState<{
    job?: SqlJob;
    initialValues?: Partial<SqlJobValues>;
  } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const selectedJob = jobs.data?.find((job) => job.jobid === selectedJobId);
  const timezone =
    state.data?.settings.find(({ name }) => name === 'cron.timezone')
      ?.setting ?? 'GMT';
  const error = catalog.error ?? state.error ?? running.error;

  async function changeJob(change: SqlJobChange, onSuccess?: () => void) {
    await execPromiseWithErrorToast(
      async () => {
        await mutation.mutateAsync(change);
        onSuccess?.();
      },
      {
        loadingMessage: 'Updating SQL jobs...',
        successMessage: 'SQL jobs updated.',
        errorMessage: 'Could not update SQL jobs.',
      },
    );
  }

  if (catalog.isLoading || state.isLoading || running.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Could not load SQL Jobs</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            catalog.refetch();
            state.refetch();
            running.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const filteredJobs =
    jobs.data?.filter(
      (job) =>
        [job.jobname, job.command, job.database, job.username, job.schedule]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === 'all' || job.active === (filter === 'enabled')),
    ) ?? [];
  const wrongDatabase = Boolean(
    state.data?.schedulerDatabase &&
      state.data.schedulerDatabase !== state.data.database,
  );
  const canCreateJob = installed && preloaded && !wrongDatabase;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">SQL Jobs</h1>
          <p className="text-muted-foreground">
            Schedule SQL commands to run in Postgres using pg_cron.
          </p>
          <p className="text-muted-foreground text-sm">
            {isPlatform
              ? 'Changes run directly against your database.'
              : 'Job and extension changes create Hasura migrations in your project.'}{' '}
            Schedules use {timezone}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={installed ? 'secondary' : 'outline'}>
            {installed ? 'pg_cron enabled' : 'pg_cron disabled'}
          </Badge>
          {extension &&
            (installed ? (
              <Button
                variant="outline"
                disabled={!jobs.data || jobs.isError || mutation.isPending}
                onClick={() =>
                  setConfirmation({
                    title: 'Disable pg_cron?',
                    label: 'Disable pg_cron',
                    description:
                      'This uninstalls pg_cron and permanently deletes all SQL jobs and their run history. It does not affect webhook cron triggers. A local down migration can recreate job definitions, but cannot restore run history. The library stays preloaded.',
                    change: disableCronChange(jobs.data ?? []),
                  })
                }
              >
                Disable pg_cron
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={wrongDatabase}
                onClick={() => setExtensionDialog('install')}
              >
                Enable pg_cron
              </Button>
            ))}
        </div>
      </header>

      {!extension && (
        <Alert>
          <AlertTitle>pg_cron is unavailable</AlertTitle>
          <AlertDescription>
            The default database does not offer the pg_cron extension. Use a
            Postgres image that includes it.
          </AlertDescription>
        </Alert>
      )}
      {wrongDatabase && (
        <Alert variant="warning">
          <AlertTitle>Different scheduler database</AlertTitle>
          <AlertDescription>
            pg_cron is configured in {state.data?.schedulerDatabase}, but the
            default data source connects to {state.data?.database}. The
            extension can only be installed in the scheduler database. Update
            your Postgres configuration or data source before enabling it here.
          </AlertDescription>
        </Alert>
      )}
      {installed && !preloaded && extension && (
        <Alert variant="warning">
          <AlertTitle>pg_cron is not preloaded</AlertTitle>
          <AlertDescription>
            Jobs cannot run until Postgres preloads pg_cron.
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={() => setExtensionDialog('preload')}
            >
              Configure preload
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="space-y-4 pt-4">
          {!installed ? (
            <div className="rounded-lg border p-10 text-center">
              <h2 className="font-semibold text-lg">
                Enable pg_cron to schedule SQL jobs
              </h2>
              <p className="mt-2 text-muted-foreground">
                Create recurring database maintenance tasks, refresh
                materialized views, or call stored procedures.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  className="max-w-sm"
                  aria-label="Search SQL jobs"
                  placeholder="Search jobs, SQL, or database roles..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <ToggleGroup
                  type="single"
                  aria-label="Filter SQL jobs"
                  value={filter}
                  onValueChange={(value) => value && setFilter(value)}
                >
                  <ToggleGroupItem value="all">All</ToggleGroupItem>
                  <ToggleGroupItem value="enabled">Enabled</ToggleGroupItem>
                  <ToggleGroupItem value="disabled">Disabled</ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="outline"
                  aria-label="Refresh SQL jobs"
                  disabled={jobs.isFetching}
                  onClick={() => {
                    jobs.refetch();
                    state.refetch();
                  }}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  className="ml-auto"
                  disabled={!canCreateJob}
                  onClick={() => setForm({})}
                >
                  <Plus className="mr-2 size-4" />
                  Create SQL job
                </Button>
              </div>
              {jobs.isLoading ? (
                <Spinner />
              ) : jobs.error instanceof Error ? (
                <Alert variant="destructive">
                  <AlertDescription>{jobs.error.message}</AlertDescription>
                </Alert>
              ) : (
                <SqlJobsTable
                  jobs={filteredJobs}
                  disabled={mutation.isPending || !preloaded}
                  onView={(job) => setSelectedJobId(job.jobid)}
                  onEdit={(job) => setForm({ job })}
                  onToggle={(job) => changeJob(setSqlJobActiveChange(job))}
                  onDelete={(job) =>
                    setConfirmation({
                      title: `Delete ${job.jobname ?? `Job ${job.jobid}`}?`,
                      label: 'Delete job',
                      description:
                        'This removes the job from the scheduler. Recorded run history is kept in Postgres. A currently running command is not cancelled.',
                      change: deleteSqlJobChange(job),
                    })
                  }
                />
              )}
              {!jobs.isLoading &&
                !jobs.isError &&
                filteredJobs.length === 0 && (
                  <p className="py-10 text-center text-muted-foreground">
                    {jobs.data?.length
                      ? 'No jobs match your search or filter.'
                      : 'No SQL jobs yet. Create a job to get started.'}
                  </p>
                )}
            </>
          )}
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          {state.data && (
            <CronSettings
              state={state.data}
              canCreateJob={canCreateJob}
              onCreateRetentionJob={() =>
                setForm({
                  initialValues: {
                    jobname: 'cleanup-cron-run-history',
                    schedule: '0 5 * * *',
                    command:
                      "DELETE FROM cron.job_run_details\nWHERE end_time < now() - interval '7 days';",
                  },
                })
              }
            />
          )}
        </TabsContent>
      </Tabs>

      {extensionDialog === 'install' && extension && (
        <InstallExtensionDialog
          extension={extension}
          catalog={catalog.data ?? []}
          dataSource={SQL_JOBS_DATA_SOURCE}
          open
          onOpenChange={(open) => !open && setExtensionDialog(null)}
        />
      )}
      {extensionDialog === 'preload' && extension && (
        <PreloadExtensionDialog
          extension={extension}
          dataSource={SQL_JOBS_DATA_SOURCE}
          open
          onOpenChange={(open) => !open && setExtensionDialog(null)}
        />
      )}
      {form && state.data && (
        <SqlJobForm
          job={form.job}
          initialValues={form.initialValues}
          database={state.data.database}
          timezone={timezone}
          onClose={() => setForm(null)}
        />
      )}
      {selectedJob && (
        <SqlJobDetails
          key={selectedJob.jobid}
          job={selectedJob}
          timezone={timezone}
          onClose={() => setSelectedJobId(null)}
        />
      )}
      {confirmation && (
        <AlertDialog
          open
          onOpenChange={(open) =>
            !open && !mutation.isPending && setConfirmation(null)
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {mutation.error && (
              <Alert variant="destructive">
                <AlertDescription>{mutation.error.message}</AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <ButtonWithLoading
                variant="destructive"
                loading={mutation.isPending}
                onClick={() =>
                  changeJob(confirmation.change, () => setConfirmation(null))
                }
              >
                {confirmation.label}
              </ButtonWithLoading>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
