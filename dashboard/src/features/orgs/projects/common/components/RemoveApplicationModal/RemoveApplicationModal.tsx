import router from 'next/router';
import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetOrganizationsDocument,
  useBillingDeleteAppMutation,
} from '@/generated/graphql';
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
  title?: string;
  /**
   * Description of the modal
   */
  description?: string;
  /**
   * Class name to be applied to the modal.
   */
  className?: string;
}

export default function RemoveApplicationModal({
  close,
  handler,
  title,
  description,
  className,
}: RemoveApplicationModalProps) {
  const { project } = useProject();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();
  const [loadingRemove, setLoadingRemove] = useState(false);
  const [deleteApplication] = useBillingDeleteAppMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  const [remove, setRemove] = useState(false);
  const [remove2, setRemove2] = useState(false);
  const [remove3, setRemove3] = useState(false);

  const appName = project?.name;
  const isPaidPlan = isEmptyValue(org?.plan?.isFree)
    ? false
    : !org?.plan?.isFree;

  async function handleClick() {
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
    } catch {
      await discordAnnounce(`Error trying to delete project: ${appName}`);
    }
    close();
    await router.push(`/orgs/${org?.slug}/projects`);
    triggerToast(`${project?.name} deleted`);
  }

  return (
    <div className={cn('w-full max-w-sm rounded-lg p-6 text-left', className)}>
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-semibold text-lg">{title || 'Delete Project'}</h2>

        <p className="text-muted-foreground text-sm">
          {description || 'Are you sure you want to delete this app?'}
        </p>

        <p className="font-bold text-destructive text-sm">
          This cannot be undone.
        </p>

        <div className="my-4 flex flex-col divide-y border-y">
          <div className="flex items-start gap-2 py-3">
            <Checkbox
              id="accept-1"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete Project #1"
              className="mt-0.5"
            />
            <Label
              htmlFor="accept-1"
              className="cursor-pointer font-normal leading-5"
            >
              {`I'm sure I want to delete ${appName}`}
            </Label>
          </div>

          <div className="flex items-start gap-2 py-3">
            <Checkbox
              id="accept-2"
              checked={remove2}
              onCheckedChange={(checked) => setRemove2(checked === true)}
              aria-label="Confirm Delete Project #2"
              className="mt-0.5"
            />
            <Label
              htmlFor="accept-2"
              className="cursor-pointer font-normal leading-5"
            >
              I understand this action cannot be undone
            </Label>
          </div>

          {isPaidPlan && (
            <div className="flex items-start gap-2 py-3">
              <Checkbox
                id="accept-3"
                checked={remove3}
                onCheckedChange={(checked) => setRemove3(checked === true)}
                aria-label="Confirm Delete Project #3"
                className="mt-0.5"
              />
              <Label
                htmlFor="accept-3"
                className="cursor-pointer font-normal leading-5"
              >
                I understand I need to delete the organization if I want to
                cancel the subscription
              </Label>
            </div>
          )}
        </div>

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading
            variant="destructive"
            onClick={handleClick}
            disabled={!remove || !remove2 || (isPaidPlan && !remove3)}
            loading={loadingRemove}
          >
            Delete Project
          </ButtonWithLoading>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
