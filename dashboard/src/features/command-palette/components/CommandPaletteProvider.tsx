import { useRouter } from 'next/router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from 'react';

import {
  isPageGated,
  type NavGating,
} from '@/components/layout/MainNav/nav-config';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { useCommandPaletteShortcut } from '@/features/command-palette/hooks/useCommandPaletteShortcut';
import { useRecent } from '@/features/command-palette/hooks/useRecent';
import {
  getEffectiveScope,
  getFallbackProject,
  getProjectHint,
  withProjectFallbackHint,
} from '@/features/command-palette/lib/fallback';
import { flattenTree } from '@/features/command-palette/lib/flatten';
import {
  commandPaletteReducer,
  createAffinityRanker,
  getScopeRoot,
  getSearchCandidates,
  getVisibleItems,
  initialCommandPaletteState,
  isContainer,
  toScoredNode,
} from '@/features/command-palette/lib/machine';
import {
  isExternalNode,
  resolvePath,
} from '@/features/command-palette/lib/resolvePath';
import { buildOrgProjectNodes } from '@/features/command-palette/lib/scopeNodes';
import { commandPaletteNavTree } from '@/features/command-palette/nav-tree';
import type {
  CommandNode,
  RecentEntry,
  ScoredNode,
} from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { type Org, useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { isNotEmptyValue } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

interface CommandPaletteContextType {
  openCommandPalette: VoidFunction;
}

const noOp = () => {};

const CommandPaletteContext = createContext<CommandPaletteContextType>({
  openCommandPalette: noOp,
});

interface CommandPaletteProviderProps {
  children: ReactNode;
}

const NO_NODES: CommandNode[] = [];
const NO_ITEMS: ScoredNode[] = [];

// Gates only children, so the root always survives filtering.
const filterNavTree = (node: CommandNode, gating: NavGating): CommandNode => ({
  ...node,
  children: node.children
    ?.filter((child) => !isPageGated(child.gate, gating))
    .map((child) => filterNavTree(child, gating)),
});

const createRecentNode = (
  entry: RecentEntry,
  originalNode: CommandNode,
  orgName?: string,
  projectName?: string,
): CommandNode => ({
  ...originalNode,
  id: `recent:${entry.nodeId}:${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
  title: entry.title,
  hint: getProjectHint(
    orgName ?? entry.orgSlug,
    projectName,
    entry.appSubdomain,
  ),
  commandPalette: {
    originalNode,
    orgSlug: entry.orgSlug,
    appSubdomain: entry.appSubdomain,
  },
});

const projectExists = (
  recentEntry: RecentEntry,
  availableProjects: Set<string>,
) => {
  if (!recentEntry.appSubdomain) {
    return true;
  }

  return availableProjects.has(
    `${recentEntry.orgSlug ?? ''}:${recentEntry.appSubdomain}`,
  );
};

const getRootPageItems = (tree: CommandNode): ScoredNode[] =>
  (tree.children ?? [])
    .flatMap((child) => (isContainer(child) ? (child.children ?? []) : [child]))
    .map(toScoredNode);

function usePaletteTrees(open: boolean, fallbackHint?: string) {
  const platformEnabled = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return useMemo(() => {
    if (!open) {
      return {
        tree: commandPaletteNavTree,
        displayTree: commandPaletteNavTree,
      };
    }

    const tree = filterNavTree(commandPaletteNavTree, {
      isNotPlatform: !platformEnabled,
      shouldDisableSettings: settingsDisabled,
    });

    // `tree` stays hint-free: it feeds the recents lookup and the scope-node
    // clone templates; `displayTree` also shows where project pages resolve
    // while no project is open.
    return {
      tree,
      displayTree: fallbackHint
        ? withProjectFallbackHint(tree, fallbackHint)
        : tree,
    };
  }, [open, platformEnabled, settingsDisabled, fallbackHint]);
}

function useOrgProjectNodes(
  enabled: boolean,
  tree: CommandNode,
  orgs: Org[],
): CommandNode[] {
  const isPlatform = useIsPlatform();

  return useMemo(() => {
    if (!enabled || !isPlatform) {
      return NO_NODES;
    }

    return buildOrgProjectNodes(orgs, tree);
  }, [enabled, isPlatform, orgs, tree]);
}

function useRecentItems(
  tree: CommandNode,
  recent: RecentEntry[],
  enabled: boolean,
  orgs: Org[],
  currentOrgSlug: string | undefined,
) {
  const { project } = useProject();

  return useMemo(() => {
    if (!enabled) {
      return NO_ITEMS;
    }

    const availableProjects = new Set(
      orgs.flatMap((org) =>
        org.apps.map((app) => `${org.slug}:${app.subdomain}`),
      ),
    );

    if (project?.subdomain) {
      availableProjects.add(`${currentOrgSlug ?? ''}:${project.subdomain}`);
    }

    const nodesById = new Map(flattenTree(tree).map((node) => [node.id, node]));
    const orgNamesBySlug = new Map(orgs.map((org) => [org.slug, org.name]));
    const projectNamesBySlugAndSubdomain = new Map(
      orgs.flatMap((org) =>
        org.apps.map((app) => [`${org.slug}:${app.subdomain}`, app.name]),
      ),
    );

    return recent
      .filter((entry) => projectExists(entry, availableProjects))
      .map((entry) => {
        const originalNode = nodesById.get(entry.nodeId);

        return originalNode
          ? toScoredNode(
              createRecentNode(
                entry,
                originalNode,
                orgNamesBySlug.get(entry.orgSlug ?? ''),
                projectNamesBySlugAndSubdomain.get(
                  `${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
                ),
              ),
            )
          : undefined;
      })
      .filter(isNotEmptyValue);
  }, [enabled, orgs, project?.subdomain, recent, currentOrgSlug, tree]);
}

const getNavigationNode = (node: CommandNode): CommandNode =>
  node.commandPalette?.originalNode ?? node;

const findOrgNode = (nodes: CommandNode[], orgSlug: string | undefined) =>
  nodes.find(
    (node) => node.kind === 'org' && node.commandPalette?.orgSlug === orgSlug,
  );

const findProjectNode = (
  nodes: CommandNode[],
  { orgSlug, appSubdomain }: { orgSlug?: string; appSubdomain?: string },
) =>
  nodes.find(
    (node) =>
      node.kind === 'project' &&
      node.commandPalette?.orgSlug === orgSlug &&
      node.commandPalette?.appSubdomain === appSubdomain,
  );

export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(
    commandPaletteReducer,
    initialCommandPaletteState,
  );
  const { orgs } = useOrgs();
  const { recent, pushRecent } = useRecent();

  const currentOrgSlug = getSingleQueryParam(router.query.orgSlug);
  const currentAppSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const routeScope = useMemo(
    () => ({ orgSlug: currentOrgSlug, appSubdomain: currentAppSubdomain }),
    [currentOrgSlug, currentAppSubdomain],
  );

  const fallbackProject = useMemo(
    () =>
      open && !currentAppSubdomain
        ? getFallbackProject(recent, orgs, currentOrgSlug)
        : undefined,
    [open, currentAppSubdomain, recent, orgs, currentOrgSlug],
  );
  const fallbackHint = fallbackProject
    ? getProjectHint(
        fallbackProject.orgName ?? fallbackProject.orgSlug,
        fallbackProject.projectName,
        fallbackProject.appSubdomain,
      )
    : undefined;

  const { tree, displayTree } = usePaletteTrees(open, fallbackHint);
  const recentItems = useRecentItems(tree, recent, open, orgs, currentOrgSlug);
  const orgProjectNodes = useOrgProjectNodes(open, tree, orgs);
  const orgProjectItems = useMemo(
    () => orgProjectNodes.map(toScoredNode),
    [orgProjectNodes],
  );
  const getAffinity = useMemo(
    () =>
      createAffinityRanker({
        orgSlug: currentOrgSlug,
        appSubdomain: currentAppSubdomain,
      }),
    [currentOrgSlug, currentAppSubdomain],
  );

  const scopeRoot = getScopeRoot(state, displayTree);
  const searchCandidates = useMemo(
    () => (open ? getSearchCandidates(scopeRoot) : NO_NODES),
    [open, scopeRoot],
  );
  const items = useMemo(
    () =>
      open
        ? getVisibleItems(
            state,
            scopeRoot,
            searchCandidates,
            orgProjectNodes,
            getAffinity,
          )
        : NO_ITEMS,
    [open, state, scopeRoot, searchCandidates, orgProjectNodes, getAffinity],
  );
  const pageItems = useMemo(
    () => (open ? getRootPageItems(displayTree) : NO_ITEMS),
    [open, displayTree],
  );

  const openCommandPalette = useCallback(() => setOpen(true), []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      dispatch({ type: 'reset' });
    }
  }, []);

  const toggleCommandPalette = useCallback(
    () => handleOpenChange(!open),
    [handleOpenChange, open],
  );

  useCommandPaletteShortcut({ open, onToggle: toggleCommandPalette });

  // Drilling scopes the missing ancestors too, so the trail always mirrors
  // the breadcrumb nav: org for a project, org > project for a feature group.
  // Feature groups swap in their project-clone counterpart so the scoped
  // children navigate to the same project the chips show.
  const handleDrill = useCallback(
    (node: CommandNode) => {
      const metadata = node.commandPalette;

      if (node.kind === 'project' && metadata?.orgSlug) {
        const orgNode = findOrgNode(orgProjectNodes, metadata.orgSlug);

        dispatch({
          type: 'drill',
          node,
          ancestors: orgNode ? [orgNode] : undefined,
        });
        return;
      }

      if (node.scope === 'project') {
        const targetScope = metadata?.orgSlug
          ? { orgSlug: metadata.orgSlug, appSubdomain: metadata.appSubdomain }
          : getEffectiveScope(node, routeScope, fallbackProject);
        const orgNode = findOrgNode(orgProjectNodes, targetScope.orgSlug);
        const projectNode = findProjectNode(orgProjectNodes, targetScope);
        const templateId = (metadata?.originalNode ?? node).id;
        const scopedNode = projectNode?.children?.find(
          (child) => child.commandPalette?.originalNode?.id === templateId,
        );

        if (orgNode && projectNode && scopedNode) {
          dispatch({
            type: 'drill',
            node: scopedNode,
            ancestors: [orgNode, projectNode],
          });
          return;
        }
      }

      dispatch({ type: 'drill', node });
    },
    [fallbackProject, orgProjectNodes, routeScope],
  );

  const handleNavigate = useCallback(
    (node: CommandNode) => {
      const navigationNode = getNavigationNode(node);
      const targetScope = node.commandPalette
        ? {
            orgSlug: node.commandPalette.orgSlug,
            appSubdomain: node.commandPalette.appSubdomain,
          }
        : getEffectiveScope(navigationNode, routeScope, fallbackProject);
      const href = resolvePath(navigationNode, targetScope);

      if (!href) {
        return;
      }

      if (isExternalNode(navigationNode)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        handleOpenChange(false);
        return;
      }

      const switchesScope =
        targetScope.orgSlug !== routeScope.orgSlug ||
        targetScope.appSubdomain !== routeScope.appSubdomain;

      router.push(href, undefined, { shallow: !switchesScope });
      pushRecent({
        nodeId: navigationNode.id,
        title: navigationNode.title,
        path: navigationNode.path ?? href,
        orgSlug: targetScope.orgSlug ?? routeScope.orgSlug,
        // Org-scoped pages ignore the project, so recording the subdomain
        // would split one destination across several recent entries.
        appSubdomain:
          navigationNode.scope === 'project'
            ? (targetScope.appSubdomain ?? routeScope.appSubdomain)
            : undefined,
      });
      handleOpenChange(false);
    },
    [fallbackProject, handleOpenChange, pushRecent, router, routeScope],
  );

  const contextValue = useMemo(
    () => ({ openCommandPalette }),
    [openCommandPalette],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        items={items}
        onDrill={handleDrill}
        onNavigate={handleNavigate}
        onOpenChange={handleOpenChange}
        onPopScope={() => dispatch({ type: 'popScope' })}
        onPopTo={(index) => dispatch({ type: 'popToScope', index })}
        onQueryChange={(query) => dispatch({ type: 'setQuery', query })}
        open={open}
        orgProjectItems={orgProjectItems}
        pageItems={pageItems}
        query={state.query}
        recentItems={recentItems}
        scopeStack={state.scopeStack}
      />
    </CommandPaletteContext.Provider>
  );
}

export const useCommandPaletteOpen = (): CommandPaletteContextType =>
  useContext(CommandPaletteContext);
