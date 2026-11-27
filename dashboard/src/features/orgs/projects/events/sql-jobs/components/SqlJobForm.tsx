import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormCodeEditor } from '@/components/form/FormCodeEditor';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { CronScheduleInput } from '@/features/orgs/projects/events/common/components/CronScheduleInput';
import {
  createSqlJobChange,
  editSqlJobChange,
} from '@/features/orgs/projects/events/sql-jobs/sql';
import {
  SQL_EDITOR_EXTENSIONS,
  SQL_EDITOR_SETUP,
} from '@/features/orgs/projects/events/sql-jobs/sql-editor';
import type {
  SqlJob,
  SqlJobValues,
} from '@/features/orgs/projects/events/sql-jobs/types';
import { useSqlJobMutation } from '@/features/orgs/projects/events/sql-jobs/use-sql-jobs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  jobname: Yup.string().trim().defined(),
  schedule: Yup.string().trim().required('A schedule is required.'),
  command: Yup.string()
    .required('SQL is required.')
    .test('not-blank', 'SQL is required.', (value) => Boolean(value?.trim())),
  database: Yup.string().trim().required('A database is required.'),
  username: Yup.string().trim().required('A database role is required.'),
  active: Yup.boolean().required(),
});

interface SqlJobFormProps {
  job?: SqlJob;
  initialValues?: Partial<SqlJobValues>;
  database: string;
  timezone: string;
  onClose: () => void;
}

export default function SqlJobForm({
  job,
  initialValues,
  database,
  timezone,
  onClose,
}: SqlJobFormProps) {
  const mutation = useSqlJobMutation();
  const [discardOpen, setDiscardOpen] = useState(false);
  const form = useForm<SqlJobValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: job
      ? { ...job, jobname: job.jobname ?? '' }
      : {
          jobname: '',
          schedule: '0 * * * *',
          command: '',
          username: 'postgres',
          active: true,
          ...initialValues,
          database,
        },
  });

  function close() {
    if (mutation.isPending) {
      return;
    }
    if (form.formState.isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  async function submit(values: SqlJobValues) {
    if (!job && !values.jobname) {
      form.setError('jobname', { message: 'A job name is required.' });
      return;
    }
    await execPromiseWithErrorToast(
      async () => {
        await mutation.mutateAsync(
          job
            ? editSqlJobChange(
                job,
                { ...values, database: job.database },
                database,
              )
            : createSqlJobChange({ ...values, database }, database),
        );
        onClose();
      },
      {
        loadingMessage: 'Saving SQL job...',
        successMessage: 'SQL job saved.',
        errorMessage: 'Could not save the SQL job.',
      },
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          disableOutsideClick
          className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 text-foreground"
        >
          <Form {...form}>
            <form
              id="sql-job-form"
              onSubmit={form.handleSubmit(submit)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <DialogHeader className="px-8 pt-8 pb-4">
                <DialogTitle className="text-xl">
                  {job ? 'Edit SQL job' : 'Create SQL job'}
                </DialogTitle>
                <DialogDescription>
                  Runs a SQL command in your database on a schedule, with the
                  permissions of the database role.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
                <fieldset disabled={mutation.isPending} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormInput
                      control={form.control}
                      name="jobname"
                      label="Job name"
                      placeholder="refresh-materialized-view"
                      disabled={Boolean(job)}
                      helperText={job ? 'A job cannot be renamed.' : undefined}
                      autoFocus
                    />
                    <FormInput
                      control={form.control}
                      name="username"
                      label="Database role"
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CronScheduleInput
                            scheduler="pg_cron"
                            {...field}
                            timezone={timezone}
                            disabled={mutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormCodeEditor
                    control={form.control}
                    name="command"
                    label="SQL command"
                    aria-label="SQL command"
                    extensions={SQL_EDITOR_EXTENSIONS}
                    basicSetup={SQL_EDITOR_SETUP}
                    indentWithTab={false}
                    readOnly={mutation.isPending}
                    className="[&_.cm-content]:min-h-40 [&_.cm-scroller]:max-h-72"
                  >
                    <FormDescription>
                      Saving schedules this SQL. It does not run it right away.
                    </FormDescription>
                  </FormCodeEditor>
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <div className="flex items-start justify-between gap-4 rounded-lg border p-6">
                        <div className="space-y-1">
                          <p className="font-medium text-base">Enabled</p>
                          <p className="text-muted-foreground text-sm">
                            Paused jobs keep their settings but don&apos;t run
                            on schedule.
                          </p>
                        </div>
                        <Switch
                          type="button"
                          aria-label="Enabled"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                </fieldset>
                {mutation.error && (
                  <Alert variant="destructive" className="mt-6">
                    <AlertDescription className="whitespace-pre-wrap">
                      {mutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t px-8 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <ButtonWithLoading type="submit" loading={mutation.isPending}>
                  {job ? 'Save changes' : 'Create job'}
                </ButtonWithLoading>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscardChanges={onClose}
      />
    </>
  );
}
