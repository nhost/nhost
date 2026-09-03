import { zodResolver } from '@hookform/resolvers/zod';
import router from 'next/router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
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
import { cn, isEmptyValue } from '@/lib/utils';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';

export interface RemoveApplicationModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: () => unknown;
  /**
   * A custom function to be run instead of the own handle function defined by the component.
   */
  handler?: () => unknown;
  /**
   * The title of the modal.
   */
  title?: ReactNode;
  /**
   * Description of the modal
   */
  description?: ReactNode;
  /**
   * Class name to be applied to the modal.
   */
  className?: string;
  /**
   * Called when the deletion starts and finishes so the surrounding dialog can
   * block dismissal while the request is in flight.
   */
  onPendingChange?: (pending: boolean) => void;
}

interface DeleteProjectFormValues {
  confirmation: string;
  acknowledgeIrreversible: boolean;
  acknowledgeSubscription: boolean;
}

export default function RemoveApplicationModal({
  close,
  handler,
  title,
  description,
  className,
  onPendingChange,
}: RemoveApplicationModalProps) {
  const { project } = useProject();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();
  const track = useTrackEvent();
  const [loadingRemove, setLoadingRemove] = useState(false);
  const [deleteApplication] = useBillingDeleteAppMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  const appName = project?.name;
  const orgName = org?.name;
  const requiredProjectConfirmation =
    typeof orgName === 'string' &&
    orgName.length > 0 &&
    typeof appName === 'string' &&
    appName.length > 0
      ? `${orgName}/${appName}`
      : null;
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
          .refine(
            (value) =>
              requiredProjectConfirmation !== null &&
              value === requiredProjectConfirmation,
            { message: 'Value does not match' },
          ),
        // Empty messages suppress FormMessage; the disabled action is the only
        // affordance the acknowledgments need.
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

  useEffect(() => {
    onPendingChange?.(loadingRemove);
  }, [loadingRemove, onPendingChange]);

  async function handleDelete() {
    if (loadingRemove) {
      return;
    }

    setLoadingRemove(true);

    if (handler) {
      await handler();
      setLoadingRemove(false);
      if (close) {
        close();
      }
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
      await discordAnnounce(`Error trying to delete project: ${appName}`);
      setLoadingRemove(false);
      triggerToast(`An error occurred while trying to delete ${appName}`);
      return;
    }
    close();
    await router.push(`/orgs/${org?.slug}/projects`);
    triggerToast(`${project?.name} deleted`);
  }

  return (
    <div
      className={cn(
        'w-full max-w-lg rounded-lg bg-paper p-6 text-left text-foreground',
        className,
      )}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleDelete)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-lg">
              {title || 'Delete Project'}
            </h2>

            <p className="text-muted-foreground text-sm">
              {description || 'Are you sure you want to delete this app?'}
            </p>

            <p className="font-bold text-destructive text-sm">
              This cannot be undone.
            </p>
          </div>

          <div className="flex flex-col gap-6 border-y py-6">
            <FormCheckbox
              control={form.control}
              name="acknowledgeIrreversible"
              aria-label="Confirm Delete Project #2"
              label="I understand this action cannot be undone"
              className="mt-0.5 self-start"
            />

            {isPaidPlan && (
              <FormCheckbox
                control={form.control}
                name="acknowledgeSubscription"
                aria-label="Confirm Delete Project #3"
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
                  <InlineCode className="max-w-full select-none whitespace-pre-wrap break-words text-sm">
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
              variant="outline"
              onClick={close}
              disabled={loadingRemove}
            >
              Cancel
            </Button>

            <ButtonWithLoading
              type="submit"
              variant="destructive"
              disabled={!canDeleteProject}
              loading={loadingRemove}
            >
              Delete Project
            </ButtonWithLoading>
          </div>
        </form>
      </Form>
    </div>
  );
}
