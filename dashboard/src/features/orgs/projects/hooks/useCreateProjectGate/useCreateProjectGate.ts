import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { ApplicationStatus } from '@/types/application';

export interface UseCreateProjectGateReturnType {
  /**
   * True once we know creating a project in the current org would hit the
   * "Starter plan can only have one project live at a time" rule that's
   * already enforced server side (see getCreateProjectErrorMessage): the
   * org is on a free plan and already has a project whose desired state is
   * Live.
   *
   * This intentionally does NOT reuse useAppPausedReason's
   * freeAndLiveProjectsNumberExceeded (backed by getFreeAndActiveProjects,
   * which filters on each app's legacyPlan.isFree). Checked live against
   * the dev backend: legacyPlan comes back null on current apps/orgs (it's
   * not populated by the current plan model), so that query silently
   * returns zero matches even when the org clearly has a live project on a
   * free plan - it would never have blocked anyone. This hook checks the
   * org's own plan and its own apps' desiredState instead, both already
   * fetched by useOrgs, so there's no extra query and no dependency on
   * that stale field.
   */
  isBlocked: boolean;
  /**
   * Subdomain of the org's live project, i.e. the one actually blocking
   * creation of a new one. Used to deep link "pause" / "delete" straight
   * to that project's settings page instead of just naming the org.
   * Undefined whenever isBlocked is false.
   */
  liveProjectSubdomain?: string;
}

export default function useCreateProjectGate(): UseCreateProjectGateReturnType {
  const { currentOrg } = useOrgs();

  const liveProject = currentOrg?.apps.find(
    (app) => app.desiredState === ApplicationStatus.Live,
  );

  const isBlocked = Boolean(currentOrg?.plan.isFree) && Boolean(liveProject);

  return { isBlocked, liveProjectSubdomain: liveProject?.subdomain };
}
