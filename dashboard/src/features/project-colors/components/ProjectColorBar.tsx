import { type CSSProperties, useEffect } from 'react';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import useProjectColors from '@/features/project-colors/hooks/useProjectColors';
import useProjectFavicon from '@/features/project-colors/hooks/useProjectFavicon';

/**
 * The thin line in the project's color across the top of every project page,
 * plus the colored tab icon. Shows nothing outside a project, for a project
 * without a color, or when project colors are turned off.
 */
export default function ProjectColorBar() {
  const { project } = useProject();
  const { orgs, loading: loadingOrgs } = useOrgs();
  const { enabled, getColorFor, keepOnly } = useProjectColors();
  const color = enabled ? getColorFor(project?.id) : undefined;

  // A deleted project, or one the person lost access to, gives its color back.
  useEffect(() => {
    if (loadingOrgs || orgs.length === 0) {
      return;
    }

    keepOnly(orgs.flatMap((org) => org.apps.map((app) => app.id)));
  }, [orgs, loadingOrgs, keepOnly]);

  useProjectFavicon(color);

  if (!color) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="project-color-bar"
      className="h-[5px] w-full shrink-0 border-[var(--project-bar-edge)] border-b bg-[var(--project-bar)] dark:border-transparent dark:bg-[var(--project-bar-dark)]"
      style={
        {
          '--project-bar': color.bar,
          '--project-bar-dark': color.barDark,
          '--project-bar-edge': color.barEdge ?? color.bar,
        } as CSSProperties
      }
    />
  );
}
