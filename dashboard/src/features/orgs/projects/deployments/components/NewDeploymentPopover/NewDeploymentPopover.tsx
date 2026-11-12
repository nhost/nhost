import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useScheduleDeployment } from '@/features/orgs/projects/deployments/hooks/useScheduleDeployment';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { usePendingOrRunningUnifiedDeploymentsSubSubscription } from '@/generated/graphql';

const validationSchema = z.object({
  ref: z
    .string()
    .trim()
    .min(1, 'Enter a branch, tag or commit SHA.')
    .regex(/^\S+$/, "A ref can't contain spaces."),
  commitMessage: z.string().trim().min(1, 'Enter a commit message.'),
});

type NewDeploymentFormValues = z.infer<typeof validationSchema>;

function NewDeploymentForm({ onScheduled }: { onScheduled: VoidFunction }) {
  const { project } = useProject();
  const { schedule } = useScheduleDeployment();
  const form = useForm<NewDeploymentFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: { ref: '', commitMessage: '' },
  });
  const { isSubmitting } = form.formState;

  async function deploy({ ref, commitMessage }: NewDeploymentFormValues) {
    await schedule({ commitSHA: ref, commitMessage }, onScheduled);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(deploy)} className="grid gap-4">
        <div className="grid gap-0.5">
          <p className="font-semibold text-base">
            Deploy a branch, tag or commit
          </p>
          <p className="text-muted-foreground text-xs">
            From {project?.githubRepository?.fullName}
          </p>
        </div>
        <FormInput<NewDeploymentFormValues>
          control={form.control}
          name="ref"
          label="Branch, tag or commit SHA"
          placeholder="git_ref"
          helperText="Use the full 40-character SHA for a commit."
          autoComplete="off"
          spellCheck={false}
        />
        <FormInput<NewDeploymentFormValues>
          control={form.control}
          name="commitMessage"
          label="Commit message"
          autoComplete="off"
        />
        <Alert variant="warning">
          <AlertDescription>
            This ref's metadata, settings and functions will replace the current
            ones. <strong>Database migrations are not rolled back.</strong>
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-2">
          <PopoverClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </PopoverClose>
          <ButtonWithLoading
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Deploy
          </ButtonWithLoading>
        </div>
      </form>
    </Form>
  );
}

export default function NewDeploymentPopover() {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const { data: pendingData } =
    usePendingOrRunningUnifiedDeploymentsSubSubscription({
      variables: { appId: project?.id },
      skip: !project,
      onData: ({ data }) => {
        if (data.data?.unifiedDeployments.length) {
          setOpen(false);
        }
      },
    });
  const inProgress = (pendingData?.unifiedDeployments.length ?? 0) > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="has-[:disabled]:cursor-not-allowed">
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={inProgress}>
                New deployment
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        {inProgress && (
          <TooltipContent>
            Deployments cannot be triggered when a deployment is in progress.
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent align="end" className="w-96">
        <NewDeploymentForm onScheduled={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
