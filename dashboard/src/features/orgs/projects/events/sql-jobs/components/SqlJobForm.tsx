import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormCodeEditor } from '@/components/form/FormCodeEditor';
import { FormInput } from '@/components/form/FormInput';
import { FormSwitch } from '@/components/form/FormSwitch';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
            ? editSqlJobChange(job, { ...values, database: job.database })
            : createSqlJobChange({ ...values, database }),
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
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          disableOutsideClick
        >
          <DialogHeader>
            <DialogTitle>{job ? 'Edit SQL job' : 'Create SQL job'}</DialogTitle>
            <DialogDescription>
              Schedule SQL commands with pg_cron. Commands execute with the
              permissions of the selected database role.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
              <fieldset disabled={mutation.isPending} className="space-y-5">
                <FormInput
                  control={form.control}
                  name="jobname"
                  label="Job name"
                  placeholder="refresh-materialized-view"
                  disabled={Boolean(job)}
                  autoFocus
                />
                {job && (
                  <p className="text-muted-foreground text-sm">
                    A job cannot be renamed. Create a new job to use another
                    name.
                  </p>
                )}
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
                    Saving schedules this SQL; it does not execute it
                    immediately.
                  </FormDescription>
                </FormCodeEditor>
                <FormInput
                  control={form.control}
                  name="username"
                  label="Database role"
                />
                <FormSwitch
                  control={form.control}
                  name="active"
                  label="Enabled"
                  helperText="Disabled jobs keep their configuration but do not run on schedule."
                />
              </fieldset>
              {mutation.error && (
                <Alert variant="destructive">
                  <AlertDescription className="whitespace-pre-wrap">
                    {mutation.error.message}
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
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
              </DialogFooter>
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
