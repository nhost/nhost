import {
  CircleOff,
  Plus,
  Settings,
  SquareTerminal,
  TriangleAlert,
  Webhook,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import SidebarNoticeRow from '@/components/layout/SidebarNoticeRow/SidebarNoticeRow';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
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
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { InstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/InstallExtensionDialog';
import { PreloadExtensionDialog } from '@/features/orgs/projects/database/extensions/components/PreloadExtensionDialog';
import { usePostgresExtensionsQuery } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePreloadedLibrariesQuery } from '@/features/orgs/projects/database/extensions/hooks/usePreloadedLibrariesQuery';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import { EventsEmptyState } from '@/features/orgs/projects/events/common/components/EventsEmptyState';
import CronJobListItem from '@/features/orgs/projects/events/cron-jobs/components/CronJobListItem';
import {
  CronJobsSidebarError,
  CronJobsSidebarLoading,
} from '@/features/orgs/projects/events/cron-jobs/components/CronJobsSidebarStatus';
import { cronJobsPath } from '@/features/orgs/projects/events/cron-jobs/cron-jobs-path';
import { CreateCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/CreateCronTriggerForm';
import CronTriggerListItem from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar/CronTriggerListItem';
import { CronTriggerView } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView';
import { useGetCronTriggers } from '@/features/orgs/projects/events/cron-triggers/hooks/useGetCronTriggers';
import { SQL_JOBS_DATA_SOURCE } from '@/features/orgs/projects/events/sql-jobs/api';
import CronSettings from '@/features/orgs/projects/events/sql-jobs/components/CronSettings';
import SqlJobDetails from '@/features/orgs/projects/events/sql-jobs/components/SqlJobDetails';
import SqlJobForm from '@/features/orgs/projects/events/sql-jobs/components/SqlJobForm';
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
import { cn } from '@/lib/utils';

interface Confirmation {
  title: string;
  description: string;
  label: string;
  change: SqlJobChange;
  returnToList: boolean;
}

export default function SqlJobs() {
  const router = useRouter();
  const { orgSlug, appSubdomain, cronTriggerSlug, jobId, notice } =
    router.query;
  const basePath = cronJobsPath(orgSlug, appSubdomain);
  const settingsSelected = router.pathname.endsWith('/cron-jobs/settings');
  const webhook = useGetCronTriggers();
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const kind =
    jobId ||
    settingsSelected ||
    notice === 'sql' ||
    (!cronTriggerSlug && router.query.tab === 'sql')
      ? 'sql'
      : 'webhook';
  const selectedJob = jobs.data?.find((job) => job.jobid === jobId);
  const timezone =
    state.data?.settings.find(({ name }) => name === 'cron.timezone')
      ?.setting ?? 'GMT';
  const sqlError =
    catalog.error ??
    state.error ??
    running.error ??
    (installed ? jobs.error : null);
  const sqlLoading =
    catalog.isLoading ||
    state.isLoading ||
    running.isLoading ||
    (installed && jobs.isLoading);
  const database = state.data?.database;
  const wrongDatabase = Boolean(
    state.data?.schedulerDatabase && state.data.schedulerDatabase !== database,
  );
  const canCreateJob = Boolean(
    database &&
      installed &&
      preloaded &&
      !wrongDatabase &&
      !sqlError &&
      !sqlLoading,
  );
  const notPreloaded = installed && !preloaded && !wrongDatabase;
  const jobActionsDisabled = !canCreateJob || mutation.isPending;

  function confirmDelete(job: SqlJob) {
    if (!database) {
      return;
    }
    mutation.reset();
    setConfirmation({
      title: `Delete ${job.jobname ?? `Job ${job.jobid}`}?`,
      label: 'Delete job',
      description:
        'This removes the job from the scheduler. Recorded run history is kept in Postgres. A currently running command is not cancelled.',
      change: deleteSqlJobChange(job, database),
      returnToList: job.jobid === jobId,
    });
  }

  function confirmDisable() {
    if (!database || !jobs.data) {
      return;
    }
    mutation.reset();
    setConfirmation({
      title: 'Disable pg_cron?',
      label: 'Disable pg_cron',
      description:
        'This uninstalls pg_cron and permanently deletes all SQL jobs and their run history. It does not affect webhook jobs. A local down migration can recreate job definitions, but cannot restore run history. The library stays preloaded.',
      change: disableCronChange(jobs.data, database),
      returnToList: true,
    });
  }

  function toggleJob(job: SqlJob) {
    if (database) {
      changeJob(setSqlJobActiveChange(job, database));
    }
  }

  function retrySqlJobs() {
    catalog.refetch();
    running.refetch();
    state.refetch();
    if (installed) {
      jobs.refetch();
    }
  }

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

  const retentionJob = jobs.data?.find((job) =>
    /delete\s+from\s+cron\.job_run_details/i.test(job.command),
  );

  function renderPane() {
    if (typeof cronTriggerSlug === 'string') {
      return (
        <RetryableErrorBoundary key={cronTriggerSlug}>
          <CronTriggerView />
        </RetryableErrorBoundary>
      );
    }
    if (
      kind === 'sql' &&
      !sqlLoading &&
      !sqlError &&
      extension &&
      !installed &&
      !wrongDatabase
    ) {
      return (
        <section className="grid min-h-full place-content-center justify-items-center gap-3 p-6 text-center">
          <SquareTerminal
            aria-hidden
            className="size-12 text-muted-foreground"
          />
          <h2 className="font-medium text-2xl tracking-tight">
            Turn on pg_cron
          </h2>
          <p className="max-w-sm text-muted-foreground">
            SQL jobs run inside your database with the pg_cron extension. Turn
            it on to start scheduling SQL.
          </p>
          <Button
            className="mt-3"
            onClick={() => setExtensionDialog('install')}
          >
            Enable pg_cron
          </Button>
        </section>
      );
    }
    if (settingsSelected || jobId || notice) {
      if (sqlLoading) {
        return (
          <div className="p-6">
            <CronJobsSidebarLoading />
          </div>
        );
      }
      if (sqlError) {
        return (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>SQL jobs could not be loaded</AlertTitle>
              <AlertDescription>
                <Button variant="link" size="inline" onClick={retrySqlJobs}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        );
      }
      if (!extension || wrongDatabase) {
        return (
          <div className="p-6">
            {wrongDatabase ? (
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>Different scheduler database</AlertTitle>
                <AlertDescription>
                  pg_cron is configured in {state.data?.schedulerDatabase}, but
                  the default data source connects to {database}. The extension
                  can only be installed in the scheduler database. Update your
                  Postgres configuration or data source before enabling it here.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CircleOff />
                <AlertTitle>pg_cron not available</AlertTitle>
                <AlertDescription>
                  The default database does not offer the pg_cron extension. Use
                  a Postgres image that includes it.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );
      }
      if (settingsSelected && installed && state.data) {
        return (
          <CronSettings
            state={state.data}
            canCreateJob={canCreateJob}
            canDisable={Boolean(jobs.data) && !mutation.isPending}
            onDisable={confirmDisable}
            retentionJob={retentionJob}
            retentionJobHref={
              retentionJob ? `${basePath}/sql/${retentionJob.jobid}` : undefined
            }
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
        );
      }
      if (selectedJob) {
        return (
          <SqlJobDetails
            key={selectedJob.jobid}
            job={selectedJob}
            timezone={timezone}
            disabled={jobActionsDisabled}
            onEdit={() => setForm({ job: selectedJob })}
            onDelete={() => confirmDelete(selectedJob)}
            onToggle={() => toggleJob(selectedJob)}
            onConfigurePreload={
              notPreloaded ? () => setExtensionDialog('preload') : undefined
            }
          />
        );
      }
      if (jobId) {
        return (
          <EventsEmptyState
            title="SQL job not found"
            description="Select another job from the sidebar."
          />
        );
      }
    }
    const webhookLanding = kind === 'webhook' && webhook.isSuccess;
    const hasWebhooks = Boolean(webhook.data?.length);
    const sqlLanding =
      kind === 'sql' && installed && !wrongDatabase && jobs.isSuccess;
    const hasSqlJobs = Boolean(jobs.data?.length);
    if (webhookLanding || sqlLanding) {
      const Icon = webhookLanding ? Webhook : SquareTerminal;
      const hasJobs = webhookLanding ? hasWebhooks : hasSqlJobs;
      const noun = webhookLanding ? 'webhook' : 'SQL';
      return (
        <section className="grid min-h-full place-content-center justify-items-center gap-3 p-6 text-center">
          <Icon aria-hidden className="size-12 text-muted-foreground" />
          <h2 className="font-medium text-2xl tracking-tight">
            {hasJobs
              ? `${noun === 'SQL' ? 'SQL' : 'Webhook'} jobs`
              : `No ${noun} jobs yet`}
          </h2>
          <p className="max-w-sm text-muted-foreground">
            {hasJobs
              ? `Select a ${noun} job from the sidebar or create a new one.`
              : webhookLanding
                ? 'Create your first job to call a webhook URL on a schedule.'
                : 'Create your first job to run a SQL command on a schedule.'}
          </p>
          {webhookLanding ? (
            <CreateCronTriggerForm emptyState />
          ) : (
            <Button
              className="mt-3"
              disabled={!canCreateJob}
              onClick={() => setForm({})}
            >
              Create SQL job
            </Button>
          )}
        </section>
      );
    }
    return (
      <EventsEmptyState
        title="Cron jobs"
        description="Select a job from the sidebar to get started."
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0">
      <FeatureSidebar className="w-60 shrink-0 pt-0 sm:pt-0">
        {(collapse) => (
          <Tabs
            value={kind}
            onValueChange={(value) => {
              router.push(
                value === 'sql' ? `${basePath}?tab=sql` : basePath,
                undefined,
                { scroll: false },
              );
            }}
          >
            <div className="sticky top-0 z-10 bg-background px-2 pt-2.5 pb-2">
              <TabsList aria-label="Job type" className="h-9 w-full">
                <TabsTrigger value="webhook" className="flex-1 gap-1.5 py-1">
                  Webhook
                  {Boolean(webhook.data?.length) && (
                    <span className="font-normal text-muted-foreground text-xs">
                      {webhook.data?.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sql" className="flex-1 gap-1.5 py-1">
                  SQL
                  {installed &&
                    !wrongDatabase &&
                    Boolean(jobs.data?.length) && (
                      <span className="font-normal text-muted-foreground text-xs">
                        {jobs.data?.length}
                      </span>
                    )}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1 pt-1 empty:hidden">
                {kind === 'webhook' ? (
                  <CreateCronTriggerForm />
                ) : (
                  extension &&
                  (installed || wrongDatabase) &&
                  !sqlLoading &&
                  !sqlError && (
                    <>
                      <Button
                        variant="link"
                        className="!text-sm+ flex min-w-0 flex-1 justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
                        disabled={!canCreateJob}
                        onClick={() => {
                          collapse();
                          setForm({});
                        }}
                      >
                        New SQL Job <Plus className="h-4 w-4" />
                      </Button>
                      {installed && !wrongDatabase && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="subtle"
                              size="icon-sm"
                              aria-label="SQL scheduler settings"
                              aria-current={
                                settingsSelected ? 'page' : undefined
                              }
                              className={cn(settingsSelected && 'text-primary')}
                              onClick={() => {
                                collapse();
                                router.push(`${basePath}/settings`);
                              }}
                            >
                              <Settings />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            SQL scheduler settings
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )
                )}
              </div>
            </div>
            <TabsContent value="webhook" className="mt-0 px-2 pb-4">
              {webhook.isLoading ? (
                <CronJobsSidebarLoading />
              ) : webhook.isError ? (
                <CronJobsSidebarError
                  message="Webhook jobs could not be loaded."
                  onRetry={() => webhook.refetch()}
                />
              ) : webhook.data?.length ? (
                webhook.data.map((job) => (
                  <CronTriggerListItem
                    key={job.name}
                    cronTrigger={job}
                    onNavigate={collapse}
                  />
                ))
              ) : (
                <p className="p-2.5 text-muted-foreground text-sm">
                  No webhook jobs yet
                </p>
              )}
            </TabsContent>
            <TabsContent value="sql" className="mt-0 px-2 pb-4">
              {sqlLoading ? (
                <CronJobsSidebarLoading />
              ) : sqlError ? (
                <CronJobsSidebarError
                  message="SQL jobs could not be loaded."
                  onRetry={retrySqlJobs}
                />
              ) : !extension || wrongDatabase ? (
                <SidebarNoticeRow
                  icon={wrongDatabase ? <TriangleAlert /> : <CircleOff />}
                  tone={wrongDatabase ? 'warning' : 'muted'}
                  selected={notice === 'sql'}
                  onClick={() => {
                    collapse();
                    router.push(`${basePath}?notice=sql`);
                  }}
                >
                  {wrongDatabase
                    ? 'Different database'
                    : 'pg_cron not available'}
                </SidebarNoticeRow>
              ) : (
                installed && (
                  <>
                    {notPreloaded && (
                      <SidebarNoticeRow
                        icon={<TriangleAlert />}
                        tone="warning"
                        onClick={() => {
                          collapse();
                          setExtensionDialog('preload');
                        }}
                      >
                        Configure preload
                      </SidebarNoticeRow>
                    )}
                    {jobs.data?.map((job) => (
                      <CronJobListItem
                        key={job.jobid}
                        href={`${basePath}/sql/${job.jobid}`}
                        name={job.jobname ?? `Job ${job.jobid}`}
                        selected={job.jobid === jobId}
                        schedule={describeCronSchedule(job.schedule)}
                        paused={!job.active}
                        onNavigate={collapse}
                      />
                    ))}
                    {!jobs.data?.length && (
                      <p className="p-2.5 text-muted-foreground text-sm">
                        No SQL jobs yet
                      </p>
                    )}
                  </>
                )
              )}
            </TabsContent>
          </Tabs>
        )}
      </FeatureSidebar>
      <div className="min-w-0 flex-1 overflow-auto" key={router.asPath}>
        {renderPane()}
      </div>
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
      {confirmation && (
        <AlertDialog
          open
          onOpenChange={(open) =>
            !open && !mutation.isPending && setConfirmation(null)
          }
        >
          <AlertDialogContent className="gap-6 p-12">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">
                {confirmation.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {mutation.error && (
              <Alert variant="destructive">
                <AlertDescription>{mutation.error.message}</AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel disabled={mutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <ButtonWithLoading
                variant="destructive"
                loading={mutation.isPending}
                onClick={() =>
                  changeJob(confirmation.change, () => {
                    setConfirmation(null);
                    if (confirmation.returnToList) {
                      router.push(`${basePath}?tab=sql`);
                    }
                  })
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
