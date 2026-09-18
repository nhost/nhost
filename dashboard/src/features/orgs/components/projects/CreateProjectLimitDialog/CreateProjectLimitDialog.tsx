import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppDialog } from '@/components/layout/AppDialog';

/**
 * Plain text fallback, and shared with getCreateProjectErrorMessage's
 * mapping of the equivalent server side error, so the two never drift
 * apart. The dialog itself renders a richer version with "pause" and
 * "delete" linked to the project's settings page whenever it has enough
 * routing info to build that link (see description below).
 */
export const CREATE_PROJECT_LIMIT_MESSAGE =
  'Your free organization already has a live project. Pause or delete it before creating another.';

export interface CreateProjectLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Slug of the org the limit was hit in, used to route Upgrade to that
   * org's billing page, and as part of the pause/delete deep link.
   * Optional only so a caller mid hydration doesn't have to fight the
   * type; both are a no-op until it's available, which in practice is
   * always by the time this dialog can open at all.
   */
  orgSlug?: string;
  /**
   * Subdomain of the org's live project, i.e. the one actually blocking
   * creation of a new one (from useCreateProjectGate). Used to link
   * "pause" and "delete" straight to that project's settings page, where
   * both actions already live side by side. Falls back to the plain,
   * unlinked message when unavailable.
   */
  projectSubdomain?: string;
}

export default function CreateProjectLimitDialog({
  open,
  onOpenChange,
  orgSlug,
  projectSubdomain,
}: CreateProjectLimitDialogProps) {
  const { push } = useRouter();

  const projectSettingsHref =
    orgSlug && projectSubdomain
      ? `/orgs/${orgSlug}/projects/${projectSubdomain}/settings`
      : undefined;

  // Pause and Delete both live on this same settings page (the "general"
  // tab, which is also the page's default), so both links point at the
  // same URL - there isn't a separate route per action to send each word
  // to.
  const description = projectSettingsHref ? (
    <>
      Your free organization already has a live project.{' '}
      <Link href={projectSettingsHref} className="text-primary-text underline">
        Pause
      </Link>{' '}
      or{' '}
      <Link href={projectSettingsHref} className="text-primary-text underline">
        delete
      </Link>{' '}
      it before creating another.
    </>
  ) : (
    CREATE_PROJECT_LIMIT_MESSAGE
  );

  return (
    <AppDialog
      type="confirm"
      open={open}
      onOpenChange={onOpenChange}
      title="You already have a live project"
      description={description}
      cancelLabel="Close"
      primaryAction={{
        label: 'Upgrade your plan',
        onClick: () => {
          if (!orgSlug) {
            return;
          }

          push(`/orgs/${orgSlug}/billing?openUpgradeModal=true`);
        },
      }}
    />
  );
}
