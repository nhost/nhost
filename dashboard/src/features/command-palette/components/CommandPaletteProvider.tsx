import { Box, Building2 } from 'lucide-react';
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
import { flattenTree } from '@/features/command-palette/lib/flatten';
import {
  commandPaletteReducer,
  getScopeRoot,
  getSearchCandidates,
  getVisibleItems,
  initialCommandPaletteState,
  isContainer,
  toScoredNode,
} from '@/features/command-palette/lib/machine';
import {
  getQueryString,
  isExternalNode,
  resolvePath,
} from '@/features/command-palette/lib/resolvePath';
import { commandPaletteNavTree } from '@/features/command-palette/nav-tree';
import type {
  CommandNode,
  RecentEntry,
  ScoredNode,
} from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { isNotEmptyValue } from '@/lib/utils';

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

type CommandNodeMetadata =
  | {
      source: 'recent';
      originalNode: CommandNode;
      orgSlug?: string;
      appSubdomain?: string;
    }
  | {
      source: 'switch';
      orgSlug: string;
      appSubdomain?: string;
    };

type RuntimeCommandNode = CommandNode & {
  commandPalette?: CommandNodeMetadata;
};

const NO_NODES: CommandNode[] = [];
const NO_ITEMS: ScoredNode[] = [];

interface PaletteGating extends NavGating {
  projectActive: boolean;
}

const isNodeGated = (node: CommandNode, gating: PaletteGating) =>
  isPageGated(node.gate, gating) ||
  (node.scope === 'project' && !gating.projectActive);

// Gates only children, so the root always survives filtering.
const filterNavTree = (
  node: CommandNode,
  gating: PaletteGating,
): CommandNode => ({
  ...node,
  children: node.children
    ?.filter((child) => !isNodeGated(child, gating))
    .map((child) => filterNavTree(child, gating)),
});

const getProjectHint = (
  orgName: string | undefined,
  projectName: string | undefined,
  appSubdomain: string | undefined,
) => {
  if (!appSubdomain) {
    return orgName;
  }

  return [
    orgName,
    projectName ? `${projectName} (${appSubdomain})` : appSubdomain,
  ]
    .filter(Boolean)
    .join(' / ');
};

const createRecentNode = (
  entry: RecentEntry,
  originalNode: CommandNode,
  orgName?: string,
  projectName?: string,
): RuntimeCommandNode => ({
  ...originalNode,
  id: `recent:${entry.nodeId}:${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
  title: entry.title,
  hint: getProjectHint(
    orgName ?? entry.orgSlug,
    projectName,
    entry.appSubdomain,
  ),
  commandPalette: {
    source: 'recent',
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

function useNavTrees(open: boolean, projectActive: boolean) {
  const platformEnabled = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return useMemo(() => {
    if (!open) {
      return {
        tree: commandPaletteNavTree,
        displayTree: commandPaletteNavTree,
      };
    }

    const gating: PaletteGating = {
      isNotPlatform: !platformEnabled,
      shouldDisableSettings: settingsDisabled,
      projectActive: true,
    };
    // `tree` keeps project pages so recent entries from other projects still
    // resolve; `displayTree` additionally hides them while no project is open.
    const tree = filterNavTree(commandPaletteNavTree, gating);
    const displayTree = projectActive
      ? tree
      : filterNavTree(commandPaletteNavTree, {
          ...gating,
          projectActive: false,
        });

    return { tree, displayTree };
  }, [open, platformEnabled, settingsDisabled, projectActive]);
}

function useSwitchNodes(enabled: boolean): RuntimeCommandNode[] {
  const isPlatform = useIsPlatform();
  const { orgs } = useOrgs();

  return useMemo(() => {
    if (!enabled || !isPlatform) {
      return NO_NODES;
    }

    return orgs.flatMap((org) => {
      const orgNode: RuntimeCommandNode = {
        id: `switch:org:${org.slug}`,
        title: org.name,
        icon: <Building2 />,
        kind: 'org',
        path: 'projects',
        scope: 'org',
        hint: org.slug,
        keywords: [org.slug],
        commandPalette: {
          source: 'switch',
          orgSlug: org.slug,
        },
      };

      const projectNodes = org.apps.map(
        (app): RuntimeCommandNode => ({
          id: `switch:project:${org.slug}:${app.subdomain}`,
          title: app.name,
          icon: <Box />,
          kind: 'project',
          path: '',
          scope: 'project',
          hint: getProjectHint(org.name, app.name, app.subdomain),
          keywords: [org.name, org.slug, app.name, app.subdomain],
          commandPalette: {
            source: 'switch',
            orgSlug: org.slug,
            appSubdomain: app.subdomain,
          },
        }),
      );

      return [orgNode, ...projectNodes];
    });
  }, [enabled, isPlatform, orgs]);
}

function useRecentItems(
  tree: CommandNode,
  recent: RecentEntry[],
  enabled: boolean,
) {
  const { orgs } = useOrgs();
  const { project } = useProject();
  const router = useRouter();

  return useMemo(() => {
    if (!enabled) {
      return NO_ITEMS;
    }

    const currentOrgSlug = getQueryString(router.query.orgSlug);
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
  }, [enabled, orgs, project?.subdomain, recent, router.query.orgSlug, tree]);
}

const getNavigationNode = (node: RuntimeCommandNode): CommandNode => {
  if (node.commandPalette?.source === 'recent') {
    return node.commandPalette.originalNode;
  }

  return node;
};

export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(
    commandPaletteReducer,
    initialCommandPaletteState,
  );
  const hasActiveProject = Boolean(getQueryString(router.query.appSubdomain));
  const { tree, displayTree } = useNavTrees(open, hasActiveProject);
  const { recent, pushRecent } = useRecent();
  const recentItems = useRecentItems(tree, recent, open);
  const switchNodes = useSwitchNodes(open);
  const switchItems = useMemo(
    () => switchNodes.map(toScoredNode),
    [switchNodes],
  );

  const scopeRoot = getScopeRoot(state, displayTree);
  const searchCandidates = useMemo(
    () => (open ? getSearchCandidates(scopeRoot) : NO_NODES),
    [open, scopeRoot],
  );
  const items = useMemo(
    () =>
      open
        ? getVisibleItems(state, scopeRoot, searchCandidates, switchNodes)
        : NO_ITEMS,
    [open, state, scopeRoot, searchCandidates, switchNodes],
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

  const handleNavigate = useCallback(
    (node: CommandNode) => {
      const runtimeNode = node as RuntimeCommandNode;
      const navigationNode = getNavigationNode(runtimeNode);
      const currentOrgSlug = getQueryString(router.query.orgSlug);
      const currentAppSubdomain = getQueryString(router.query.appSubdomain);
      const targetScope = runtimeNode.commandPalette
        ? {
            orgSlug: runtimeNode.commandPalette.orgSlug,
            appSubdomain: runtimeNode.commandPalette.appSubdomain,
          }
        : { orgSlug: currentOrgSlug, appSubdomain: currentAppSubdomain };
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
        targetScope.orgSlug !== currentOrgSlug ||
        targetScope.appSubdomain !== currentAppSubdomain;

      router.push(href, undefined, { shallow: !switchesScope });
      pushRecent({
        nodeId: navigationNode.id,
        title: navigationNode.title,
        path: navigationNode.path ?? href,
        orgSlug: targetScope.orgSlug ?? currentOrgSlug,
        // Org-scoped pages ignore the project, so recording the subdomain
        // would split one destination across several recent entries.
        appSubdomain:
          navigationNode.scope === 'project'
            ? (targetScope.appSubdomain ?? currentAppSubdomain)
            : undefined,
      });
      handleOpenChange(false);
    },
    [handleOpenChange, pushRecent, router],
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
        onDrill={(node) => dispatch({ type: 'drill', node })}
        onNavigate={handleNavigate}
        onOpenChange={handleOpenChange}
        onPopScope={() => dispatch({ type: 'popScope' })}
        onQueryChange={(query) => dispatch({ type: 'setQuery', query })}
        open={open}
        pageItems={pageItems}
        query={state.query}
        recentItems={recentItems}
        scopeStack={state.scopeStack}
        switchItems={switchItems}
      />
    </CommandPaletteContext.Provider>
  );
}

export const useCommandPaletteOpen = (): CommandPaletteContextType =>
  useContext(CommandPaletteContext);
