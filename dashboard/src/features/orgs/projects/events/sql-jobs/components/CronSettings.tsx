import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import { FormSwitch } from '@/components/form/FormSwitch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Spinner } from '@/components/ui/v3/spinner';
import { GitHubConnectedNotice } from '@/features/orgs/projects/common/components/settings/GitHubConnectedNotice';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { CronState } from '@/features/orgs/projects/events/sql-jobs/types';
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
    .test(
      'timezone',
      'Enter a valid IANA timezone, such as Europe/Stockholm.',
      (value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
    ),
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
}

function CronConfigForm({
  state,
  canCreateJob,
  onCreateRetentionJob,
}: CronSettingsProps) {
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submit)}
        className="max-w-2xl space-y-5 rounded-lg border p-6"
      >
        <h2 className="font-semibold text-lg">Scheduler settings</h2>
        <p className="text-muted-foreground text-sm">
          These settings apply to every SQL job. They are saved in the project
          configuration, not in database migrations.
          {isPlatform
            ? ' Saving restarts Postgres and causes a short downtime.'
            : ' Locally, they are saved to nhost.toml. Run nhost up to restart Postgres and apply them.'}
        </p>
        <fieldset className="space-y-5" disabled={saving}>
          <FormInput
            control={form.control}
            name="timezone"
            label="Timezone"
            helperText="For example, GMT, UTC, or Europe/Stockholm. Changing this affects every job's schedule."
          />
          <FormInput
            control={form.control}
            name="maxRunningJobs"
            label="Maximum concurrent jobs"
            type="number"
            helperText={`This server accepts ${minJobs}–${maxJobs} concurrent jobs. Zero stops jobs from running.`}
          />
          <div className="space-y-2">
            <FormSwitch
              control={form.control}
              name="logRun"
              label="Record job runs"
              helperText="Run history is not cleaned up automatically."
            />
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <p>Consider scheduling a retention job.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canCreateJob}
                onClick={onCreateRetentionJob}
              >
                Create retention job
              </Button>
            </div>
          </div>
        </fieldset>
        <ButtonWithLoading
          type="submit"
          loading={saving}
          disabled={!form.formState.isDirty}
        >
          {isPlatform ? 'Save and restart Postgres' : 'Save settings'}
        </ButtonWithLoading>
      </form>
    </Form>
  );
}

export default function CronSettings({
  state,
  canCreateJob,
  onCreateRetentionJob,
}: CronSettingsProps) {
  const settingsDisabled = useSettingsDisabled();
  return (
    <div className="space-y-6">
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
        />
      )}
    </div>
  );
}
