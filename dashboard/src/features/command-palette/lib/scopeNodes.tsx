import { Box, Building2 } from 'lucide-react';
import { getProjectHint } from '@/features/command-palette/lib/fallback';
import type { CommandNode, PaletteOrg } from '@/features/command-palette/types';

const iconClassName = 'h-4 w-4';

interface CloneScope {
  idPrefix: string;
  orgSlug: string;
  appSubdomain?: string;
}

const cloneForScope = (node: CommandNode, scope: CloneScope): CommandNode => ({
  ...node,
  id: `${scope.idPrefix}:${node.id}`,
  children: node.children?.map((child) => cloneForScope(child, scope)),
  commandPalette: {
    originalNode: node,
    orgSlug: scope.orgSlug,
    appSubdomain: scope.appSubdomain,
  },
});

const findChildren = (tree: CommandNode, id: string): CommandNode[] =>
  tree.children?.find((child) => child.id === id)?.children ?? [];

export const buildOrgProjectNodes = (
  orgs: PaletteOrg[],
  tree: CommandNode,
): CommandNode[] => {
  const projectPageTemplates = findChildren(tree, 'project-pages');
  const orgPageTemplates = findChildren(tree, 'org-pages');
  const overviewTemplate = projectPageTemplates.find(
    (node) => node.id === 'project-overview',
  );
  const orgProjectsTemplate = orgPageTemplates.find(
    (node) => node.id === 'org-projects',
  );

  return orgs.flatMap((org) => {
    const projectNodes = org.apps.map((app): CommandNode => {
      const idPrefix = `switch:project:${org.slug}:${app.subdomain}`;

      return {
        id: idPrefix,
        title: app.name,
        icon: <Box className={iconClassName} />,
        kind: 'project',
        path: '',
        scope: 'project',
        hint: getProjectHint(org.name, app.name, app.subdomain),
        keywords: [org.name, org.slug, app.name, app.subdomain],
        searchBoundary: true,
        children: projectPageTemplates.map((template) =>
          cloneForScope(template, {
            idPrefix,
            orgSlug: org.slug,
            appSubdomain: app.subdomain,
          }),
        ),
        commandPalette: {
          originalNode: overviewTemplate,
          orgSlug: org.slug,
          appSubdomain: app.subdomain,
        },
      };
    });

    const orgIdPrefix = `switch:org:${org.slug}`;
    const orgNode: CommandNode = {
      id: orgIdPrefix,
      title: org.name,
      icon: <Building2 className={iconClassName} />,
      kind: 'org',
      path: 'projects',
      scope: 'org',
      hint: org.slug,
      keywords: [org.slug],
      children: [
        ...projectNodes,
        ...orgPageTemplates.map((template) =>
          cloneForScope(template, { idPrefix: orgIdPrefix, orgSlug: org.slug }),
        ),
      ],
      commandPalette: {
        originalNode: orgProjectsTemplate,
        orgSlug: org.slug,
      },
    };

    return [orgNode, ...projectNodes];
  });
};
