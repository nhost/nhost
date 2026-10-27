import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Form } from '@/components/ui/v3/form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useScheduleDeployment } from '@/features/orgs/projects/deployments/hooks/useScheduleDeployment';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { usePendingOrRunningUnifiedDeploymentsSubSubscription } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

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
  const userData = useUserData();
  const { schedule } = useScheduleDeployment();
  const { data: pendingData } =
    usePendingOrRunningUnifiedDeploymentsSubSubscription({
      variables: { appId: project?.id },
      skip: !project,
    });
  const inProgress = (pendingData?.unifiedDeployments.length ?? 0) > 0;
  const form = useForm<NewDeploymentFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: { ref: '', commitMessage: '' },
  });
  const { isSubmitting } = form.formState;

  async function deploy({ ref, commitMessage }: NewDeploymentFormValues) {
    const scheduled = await schedule({
      commitSHA: ref,
      commitMessage,
      commitUserName: userData?.displayName,
      commitUserAvatarUrl: userData?.avatarUrl,
    });
    if (scheduled) {
      onScheduled();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(deploy)} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Deploy a branch, tag or commit</DialogTitle>
          <DialogDescription>
            From {project?.githubRepository?.fullName}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ButtonWithLoading
                  type="submit"
                  loading={isSubmitting}
                  disabled={inProgress || isSubmitting}
                >
                  Deploy
                </ButtonWithLoading>
              </span>
            </TooltipTrigger>
            {inProgress && (
              <TooltipContent>
                Deployments cannot be re-triggered when a deployment is in
                progress.
              </TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function NewDeploymentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          New deployment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <NewDeploymentForm onScheduled={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
