import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormSwitch } from '@/components/form/FormSwitch';
import { FormTextarea } from '@/components/form/FormTextarea';
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
import { Form } from '@/components/ui/v3/form';
import {
  createSqlJobChange,
  editSqlJobChange,
} from '@/features/orgs/projects/events/sql-jobs/sql';
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
  database: string;
  timezone: string;
  onClose: () => void;
}

export default function SqlJobForm({
  job,
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
          database,
          username: 'postgres',
          active: true,
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
          job ? editSqlJobChange(job, values) : createSqlJobChange(values),
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
                <FormInput
                  control={form.control}
                  name="schedule"
                  label="Schedule"
                  helperText={`Schedules use ${timezone}. Enter a cron expression (0 * * * *), a shortcut (@daily), or an interval (5 seconds).`}
                />
                <FormTextarea
                  control={form.control}
                  name="command"
                  label="SQL command"
                  className="min-h-40 font-mono"
                  placeholder="REFRESH MATERIALIZED VIEW public.summary;"
                  helperText="Saving schedules this SQL; it does not execute it immediately."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput
                    control={form.control}
                    name="database"
                    label="Database"
                  />
                  <FormInput
                    control={form.control}
                    name="username"
                    label="Database role"
                  />
                </div>
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
