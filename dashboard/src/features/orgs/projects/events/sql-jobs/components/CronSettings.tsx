import { yupResolver } from '@hookform/resolvers/yup';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useController, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormCombobox } from '@/components/form/FormCombobox';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Spinner } from '@/components/ui/v3/spinner';
import { Switch } from '@/components/ui/v3/switch';
import { GitHubConnectedNotice } from '@/features/orgs/projects/common/components/settings/GitHubConnectedNotice';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type {
  CronState,
  SqlJob,
} from '@/features/orgs/projects/events/sql-jobs/types';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetCronSettingsQuery,
  useUpdateCronSettingsMutation,
} from '@/generated/graphql';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export const cronSettingsSchema = Yup.object({
  timezone: Yup.string()
    .trim()
    .required()
    .test('timezone', 'Select a time zone.', (value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  maxRunningJobs: Yup.number()
    .typeError('Enter a number.')
    .integer()
    .min(0)
    .max(2147483647)
    .required(),
  logRun: Yup.boolean().required(),
});

type CronSettingsValues = Yup.InferType<typeof cronSettingsSchema>;

interface CronSettingsProps {
  state: CronState;
  canCreateJob: boolean;
  onCreateRetentionJob: VoidFunction;
  canDisable: boolean;
  onDisable: VoidFunction;
  retentionJob?: SqlJob;
  retentionJobHref?: string;
}

function utcOffset(zone: string) {
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find(({ type }) => type === 'timeZoneName')?.value ?? 'GMT';
  const match = name.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) {
    return { label: 'UTC+0', minutes: 0 };
  }
  const [, sign, hours, minutes = '00'] = match;
  const total =
    (Number(hours) * 60 + Number(minutes)) * (sign === '-' ? -1 : 1);
  const label = `UTC${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
  return { label, minutes: total };
}

function timezoneOptions(current: string) {
  const zones = new Set(['UTC', 'GMT', ...Intl.supportedValuesOf('timeZone')]);
  zones.add(current);
  return [...zones]
    .map((zone) => {
      const offset = utcOffset(zone);
      return {
        value: zone,
        label: `${zone.replaceAll('_', ' ')} (${offset.label})`,
        keywords: [zone, offset.label],
        minutes: offset.minutes,
      };
    })
    .sort((a, b) => a.minutes - b.minutes || a.value.localeCompare(b.value))
    .map(({ minutes: _minutes, ...option }) => option);
}

function CronConfigForm({
  state,
  canCreateJob,
  onCreateRetentionJob,
  retentionJob,
  retentionJobHref,
}: Pick<
  CronSettingsProps,
  | 'state'
  | 'canCreateJob'
  | 'onCreateRetentionJob'
  | 'retentionJob'
  | 'retentionJobHref'
>) {
  const concurrencySetting = state.settings.find(
    ({ name }) => name === 'cron.max_running_jobs',
  );
  const minJobs = Number(concurrencySetting?.min_val ?? 0);
  const maxJobs = Number(concurrencySetting?.max_val ?? 2147483647);
  const isPlatform = useIsPlatform();
  const localClient = useLocalMimirClient();
  const { project } = useProject();
  const options = isPlatform ? {} : { client: localClient };
  const configured = useGetCronSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...options,
  });
  const [update, { loading: saving }] = useUpdateCronSettingsMutation(options);
  const cron = configured.data?.config?.postgres.settings?.extensions?.cron;
  const values = useMemo(
    () => ({
      timezone: cron?.timezone ?? 'GMT',
      maxRunningJobs: cron?.maxRunningJobs ?? 32,
      logRun: cron?.logRun !== 'off',
    }),
    [cron?.timezone, cron?.maxRunningJobs, cron?.logRun],
  );
  const form = useForm<CronSettingsValues>({
    defaultValues: values,
    resolver: yupResolver(cronSettingsSchema),
  });
  const { field: logRun } = useController({
    control: form.control,
    name: 'logRun',
  });
  useEffect(() => {
    form.reset(values);
  }, [form, values]);

  if (configured.loading) {
    return <Spinner />;
  }
  if (configured.error || !configured.data?.config) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {configured.error?.message ?? 'The project settings are unavailable.'}
        </AlertDescription>
      </Alert>
    );
  }

  async function submit(next: CronSettingsValues) {
    if (next.maxRunningJobs < minJobs || next.maxRunningJobs > maxJobs) {
      form.setError('maxRunningJobs', {
        message: `This server accepts between ${minJobs} and ${maxJobs} concurrent jobs.`,
      });
      return;
    }
    await execPromiseWithErrorToast(
      async () => {
        await update({
          variables: {
            appId: project!.id,
            timezone: next.timezone,
            maxRunningJobs: next.maxRunningJobs,
            logRun: next.logRun ? 'on' : 'off',
          },
        });
        form.reset(next);
        await configured.refetch();
      },
      {
        loadingMessage: 'Saving pg_cron settings...',
        successMessage: isPlatform
          ? 'Settings saved. Postgres will restart to apply them.'
          : 'Settings saved. Run nhost up to apply them.',
        errorMessage: 'Could not save pg_cron settings.',
      },
    );
  }

  const zones = timezoneOptions(form.getValues('timezone') || values.timezone);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <SettingsCard>
          <SettingsCardHeader
            title="Scheduler"
            description={
              isPlatform
                ? 'Applies to every SQL job. Saving restarts Postgres and causes a short downtime.'
                : 'Applies to every SQL job. Saved to nhost.toml. Run nhost up to apply.'
            }
          />
          <SettingsCardContent className="mt-4">
            <fieldset className="grid gap-6" disabled={saving}>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormCombobox
                  control={form.control}
                  name="timezone"
                  label="Time zone"
                  placeholder="Select a time zone"
                  searchPlaceholder="Search time zones"
                  emptyText="No time zone found."
                  options={zones}
                  className="w-full"
                  disabled={saving}
                />
                <FormInput
                  control={form.control}
                  name="maxRunningJobs"
                  label={`Maximum concurrent jobs (${minJobs} to ${maxJobs})`}
                  type="number"
                />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Record job runs</p>
                  <p className="text-muted-foreground text-sm">
                    Keeps a run history for every SQL job.
                  </p>
                </div>
                <Switch
                  type="button"
                  aria-label="Record job runs"
                  checked={logRun.value}
                  onCheckedChange={logRun.onChange}
                  onBlur={logRun.onBlur}
                  ref={logRun.ref}
                  disabled={saving}
                />
              </div>
              {logRun.value && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-4 text-sm">
                  {retentionJob && retentionJobHref ? (
                    <>
                      <p className="text-muted-foreground">
                        Old run history is deleted by{' '}
                        <span className="font-medium text-foreground">
                          {retentionJob.jobname ?? `Job ${retentionJob.jobid}`}
                        </span>
                        .
                      </p>
                      <Button asChild variant="link" size="inline">
                        <Link href={retentionJobHref}>View job</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        Run history is never deleted, so it keeps growing.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canCreateJob || saving}
                        onClick={onCreateRetentionJob}
                      >
                        <Plus />
                        Create cleanup job
                      </Button>
                    </>
                  )}
                </div>
              )}
            </fieldset>
          </SettingsCardContent>
          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              loading={saving}
              disabled={!form.formState.isDirty}
            >
              {isPlatform ? 'Save and restart Postgres' : 'Save settings'}
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </form>
    </Form>
  );
}

export default function CronSettings({
  canDisable,
  onDisable,
  state,
  canCreateJob,
  onCreateRetentionJob,
  retentionJob,
  retentionJobHref,
}: CronSettingsProps) {
  const settingsDisabled = useSettingsDisabled();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="font-semibold text-xl">SQL scheduler settings</h1>
      <GitHubConnectedNotice />
      {settingsDisabled ? (
        <Alert>
          <AlertTitle>Project configuration is unavailable</AlertTitle>
          <AlertDescription>
            Configure pg_cron in your PostgreSQL server configuration.
          </AlertDescription>
        </Alert>
      ) : (
        <CronConfigForm
          state={state}
          canCreateJob={canCreateJob}
          onCreateRetentionJob={onCreateRetentionJob}
          retentionJob={retentionJob}
          retentionJobHref={retentionJobHref}
        />
      )}
      <SettingsCard>
        <SettingsCardHeader
          title="Disable pg_cron"
          description="Deletes every SQL job and its run history. Webhook jobs are not affected."
          actions={
            <Button
              variant="destructive"
              disabled={!canDisable}
              onClick={onDisable}
            >
              Disable pg_cron
            </Button>
          }
        />
      </SettingsCard>
    </div>
  );
}
