import { useCallback } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { analytics } from '@/lib/segment';

export type TrackEventProperties = Record<string, unknown>;

/**
 * Returns a `track` function that forwards to Segment while automatically
 * attaching the current `org_id` and `project_id` to every event, so each
 * event can be attributed to an organization (billing is org-scoped) and a
 * project without every call site having to resolve them.
 */
export default function useTrackEvent() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  return useCallback(
    (event: string, properties?: TrackEventProperties) => {
      analytics.track(event, {
        ...properties,
        org_id: org?.id ?? null,
        project_id: project?.id ?? null,
      });
    },
    [org?.id, project?.id],
  );
}
