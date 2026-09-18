import { zodResolver } from '@hookform/resolvers/zod';
import router from 'next/router';
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
import { AppDialog } from '@/components/layout/AppDialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetOrganizationsDocument,
  useBillingDeleteAppMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';
import { isEmptyValue } from '@/lib/utils';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';

export interface RemoveApplicationDialogProps {
  /**
   * The element that opens the dialog. Click handling is added on top of
   * whatever the element already does.
   */
  trigger: ReactElement<{ onClick?: () => void }>;
  /**
   * A custom function to run instead of the built-in project deletion flow.
   */
  handler?: () => unknown;
  /**
   * The title of the dialog.
   */
  title?: ReactNode;
  /**
   * The description of the dialog.
   */
  description?: ReactNode;
}

interface DeleteProjectFormValues {
  confirmation: string;
  acknowledgeIrreversible: boolean;
  acknowledgeSubscription: boolean;
}

export default function RemoveApplicationDialog({
  trigger,
  handler,
  title,
  description,
}: RemoveApplicationDialogProps) {
  const { project } = useProject();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();
  const track = useTrackEvent();
  const [open, setOpen] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);
  const [deleteApplication] = useBillingDeleteAppMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  const appName = project?.name;
  const orgName = org?.name;
  const requiredProjectConfirmation =
    orgName && appName ? `${orgName}/${appName}` : null;
  const isPaidPlan = isEmptyValue(org?.plan?.isFree)
    ? false
    : !org?.plan?.isFree;

  const validationSchema = useMemo(
    () =>
      z.object({
        confirmation: z
          .string()
          .min(1, {
            message: 'Typing the organization and project name is required',
          })
          .refine((value) => value === requiredProjectConfirmation, {
            message: 'Value does not match',
          }),
        acknowledgeIrreversible: z
          .boolean()
          .refine((value) => value, { message: '' }),
        acknowledgeSubscription: z
          .boolean()
          .refine((value) => !isPaidPlan || value, { message: '' }),
      }),
    [isPaidPlan, requiredProjectConfirmation],
  );

  const form = useForm<DeleteProjectFormValues>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      confirmation: '',
      acknowledgeIrreversible: false,
      acknowledgeSubscription: false,
    },
  });
  const { isValid } = form.formState;
  const canDeleteProject = isValid && !loadingRemove;

  function closeDialog() {
    form.reset();
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && loadingRemove) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset();
    }
  }

  async function handleDelete() {
    if (loadingRemove) {
      return;
    }

    setLoadingRemove(true);

    try {
      if (handler) {
        try {
          await handler();
        } catch (error) {
          console.error(error);
          return;
        }

        closeDialog();
        return;
      }

      try {
        await deleteApplication({
          variables: {
            appID: project?.id,
          },
        });
        track('Project Deleted');
      } catch {
        triggerToast(`An error occurred while trying to delete ${appName}`);
        discordAnnounce(`Error trying to delete project: ${appName}`).catch(
          (announceError) => {
            console.error(announceError);
          },
        );
        return;
      }

      closeDialog();
      await router.push(`/orgs/${org?.slug}/projects`);
      triggerToast(`${project?.name} deleted`);
    } finally {
      setLoadingRemove(false);
    }
  }

  return (
    <>
      {cloneElement(trigger, {
        onClick: () => {
          trigger.props.onClick?.();
          setOpen(true);
        },
      })}

      <AppDialog
        type="form"
        open={open}
        onOpenChange={handleOpenChange}
        title={title || 'Delete project'}
        description={
          <>
            {description || 'Are you sure you want to delete this project?'}{' '}
            <span className="text-destructive">This cannot be undone.</span>
          </>
        }
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleDelete)}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <FormCheckbox
                control={form.control}
                name="acknowledgeIrreversible"
                label="I understand this action cannot be undone"
                className="mt-0.5 self-start"
              />

              {isPaidPlan && (
                <FormCheckbox
                  control={form.control}
                  name="acknowledgeSubscription"
                  label="I understand I need to delete the organization if I want to cancel the subscription"
                  className="mt-0.5 self-start"
                />
              )}
            </div>

            <FormInput
              control={form.control}
              name="confirmation"
              autoComplete="off"
              className="border-border font-mono"
              disabled={!requiredProjectConfirmation}
              label={
                requiredProjectConfirmation ? (
                  <>
                    Type{' '}
                    <InlineCode className="max-w-full select-none whitespace-pre-wrap break-words text-sm dark:bg-secondary-400">
                      {requiredProjectConfirmation}
                    </InlineCode>{' '}
                    to confirm
                  </>
                ) : (
                  'Project confirmation is unavailable.'
                )
              }
              helperText={
                requiredProjectConfirmation
                  ? undefined
                  : 'A project name and organization name are required to enable deletion.'
              }
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline-emboss"
                disabled={loadingRemove}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>

              <ButtonWithLoading
                type="submit"
                variant="destructive"
                disabled={!canDeleteProject}
                loading={loadingRemove}
              >
                Delete project
              </ButtonWithLoading>
            </div>
          </form>
        </Form>
      </AppDialog>
    </>
  );
}
