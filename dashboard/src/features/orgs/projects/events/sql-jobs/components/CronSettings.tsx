import { yupResolver } from '@hookform/resolvers/yup';
import { Plus } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useController, useForm } from 'react-hook-form';
import * as Yup from 'yup';
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
  canDisable: boolean;
  onDisable: VoidFunction;
}

function CronConfigForm({
  state,
  canCreateJob,
  onCreateRetentionJob,
}: Pick<CronSettingsProps, 'state' | 'canCreateJob' | 'onCreateRetentionJob'>) {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
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
            <fieldset className="grid gap-4" disabled={saving}>
              <FormInput
                control={form.control}
                name="timezone"
                label="Time zone"
                helperText="For example, GMT, UTC or Europe/Stockholm."
              />
              <FormInput
                control={form.control}
                name="maxRunningJobs"
                label="Maximum concurrent jobs"
                type="number"
                helperText={`This server accepts ${minJobs}–${maxJobs} concurrent jobs. Zero stops jobs from running.`}
              />
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
        <SettingsCard>
          <SettingsCardHeader
            title="Record job runs"
            description="Keeps a run history for every SQL job."
            control={
              <Switch
                type="button"
                aria-label="Record job runs"
                checked={logRun.value}
                onCheckedChange={logRun.onChange}
                onBlur={logRun.onBlur}
                ref={logRun.ref}
                disabled={saving}
              />
            }
          />
          {logRun.value && (
            <SettingsCardContent className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">
                  Run history is not cleaned up automatically.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canCreateJob || saving}
                  onClick={onCreateRetentionJob}
                >
                  <Plus />
                  Create retention job
                </Button>
              </div>
            </SettingsCardContent>
          )}
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
}: CronSettingsProps) {
  const settingsDisabled = useSettingsDisabled();
  const isPlatform = useIsPlatform();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-xl">Scheduler settings</h1>
        <p className="text-muted-foreground text-sm">
          {isPlatform
            ? 'Changes run directly against your database.'
            : 'Job and extension changes create Hasura migrations in your project.'}
        </p>
      </div>
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
