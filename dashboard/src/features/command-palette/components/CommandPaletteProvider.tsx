import { Box, Building2 } from 'lucide-react';
import { useRouter } from 'next/router';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';

import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { useCommandPaletteShortcut } from '@/features/command-palette/hooks/useCommandPaletteShortcut';
import { useRecent } from '@/features/command-palette/hooks/useRecent';
import {
  commandPaletteReducer,
  drill,
  getVisibleItems,
  initialCommandPaletteState,
  popScope,
  reset,
  setQuery,
} from '@/features/command-palette/lib/machine';
import { resolvePath } from '@/features/command-palette/lib/resolvePath';
import {
  commandPaletteNavTree,
  platformGatedNodeIds,
} from '@/features/command-palette/nav-tree';
import type {
  CommandNode,
  RecentEntry,
  ScoredNode,
} from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  getConfigServerUrl,
  isPlatform as getStaticIsPlatform,
} from '@/utils/env';

interface CommandPaletteOpenContextType {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  openCommandPalette: VoidFunction;
  closeCommandPalette: VoidFunction;
}

const noOp = () => {};

const defaultOpenContext: CommandPaletteOpenContextType = {
  open: false,
  setOpen: noOp,
  openCommandPalette: noOp,
  closeCommandPalette: noOp,
};

const CommandPaletteOpenContext =
  createContext<CommandPaletteOpenContextType>(defaultOpenContext);

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

const toScoredNode = (node: CommandNode): ScoredNode => ({
  node,
  score: 0,
  titleRanges: [],
});

const getQueryString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const findNodeById = (
  root: CommandNode,
  nodeId: string,
): CommandNode | undefined => {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children ?? []) {
    const match = findNodeById(child, nodeId);

    if (match) {
      return match;
    }
  }

  return undefined;
};

const filterTreeForPlatform = (
  node: CommandNode,
  platformEnabled: boolean,
): CommandNode | undefined => {
  const isPlatformGated =
    node.requiresPlatform === true ||
    platformGatedNodeIds.has(
      node.id as Parameters<typeof platformGatedNodeIds.has>[0],
    );
  const configServerVariableNotSet = getConfigServerUrl() === '';
  const shouldHideLocalSettings =
    node.id === 'project-settings' &&
    !platformEnabled &&
    configServerVariableNotSet;
  const isLocalAiSettings =
    node.id === 'project-settings-ai' &&
    !platformEnabled &&
    configServerVariableNotSet;

  if (
    (!platformEnabled && isPlatformGated) ||
    shouldHideLocalSettings ||
    isLocalAiSettings
  ) {
    return undefined;
  }

  return {
    ...node,
    children: node.children
      ?.map((child) => filterTreeForPlatform(child, platformEnabled))
      .filter((child): child is CommandNode => Boolean(child)),
  };
};

const createRecentNode = (
  entry: RecentEntry,
  originalNode: CommandNode,
): RuntimeCommandNode => ({
  ...originalNode,
  id: `recent:${entry.nodeId}:${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
  title: entry.title,
  hint: [entry.orgSlug, entry.appSubdomain].filter(Boolean).join(' / '),
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

const getRootPageItems = (tree: CommandNode): ScoredNode[] => {
  const projectPages = findNodeById(tree, 'project-pages')?.children ?? [];
  const orgPages = findNodeById(tree, 'org-pages')?.children ?? [];
  const docs = findNodeById(tree, 'docs');

  return [...projectPages, ...orgPages, ...(docs ? [docs] : [])].map(
    toScoredNode,
  );
};

function useFilteredNavTree() {
  const isPlatform = useIsPlatform();
  const staticIsPlatform = getStaticIsPlatform();
  const platformEnabled = isPlatform && staticIsPlatform;

  return useMemo(
    () =>
      filterTreeForPlatform(commandPaletteNavTree, platformEnabled) ?? {
        ...commandPaletteNavTree,
        children: [],
      },
    [platformEnabled],
  );
}

function useSwitchItems() {
  const isPlatform = useIsPlatform();
  const { orgs } = useOrgs();
  const { project } = useProject();

  return useMemo(() => {
    if (!isPlatform) {
      return [];
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
        commandPalette: {
          source: 'switch',
          orgSlug: org.slug,
        },
      };

      const projectNodes = org.apps.map((app) => {
        const node: RuntimeCommandNode = {
          id: `switch:project:${org.slug}:${app.subdomain}`,
          title: app.name,
          icon: <Box />,
          kind: 'project',
          path: '',
          scope: 'project',
          hint: `${org.slug} / ${app.subdomain}`,
          commandPalette: {
            source: 'switch',
            orgSlug: org.slug,
            appSubdomain: app.subdomain,
          },
        };

        return node;
      });

      return [orgNode, ...projectNodes].filter((node) => {
        const metadata = node.commandPalette;

        return (
          metadata?.source !== 'switch' ||
          metadata.appSubdomain !== project?.subdomain ||
          metadata.orgSlug !== org.slug
        );
      });
    });
  }, [isPlatform, orgs, project?.subdomain]);
}

function useRecentItems(tree: CommandNode) {
  const { recent } = useRecent();
  const { orgs } = useOrgs();
  const { project } = useProject();
  const router = useRouter();

  return useMemo(() => {
    const currentOrgSlug = getQueryString(router.query.orgSlug);
    const availableProjects = new Set(
      orgs.flatMap((org) =>
        org.apps.map((app) => `${org.slug}:${app.subdomain}`),
      ),
    );

    if (project?.subdomain) {
      availableProjects.add(`${currentOrgSlug ?? ''}:${project.subdomain}`);
    }

    return recent
      .filter((entry) => projectExists(entry, availableProjects))
      .map((entry) => {
        const originalNode = findNodeById(tree, entry.nodeId);

        return originalNode
          ? toScoredNode(createRecentNode(entry, originalNode))
          : undefined;
      })
      .filter((item): item is ScoredNode => Boolean(item));
  }, [orgs, project?.subdomain, recent, router.query.orgSlug, tree]);
}

const getNavigationNode = (node: RuntimeCommandNode): CommandNode => {
  if (node.commandPalette?.source === 'recent') {
    return node.commandPalette.originalNode;
  }

  return node;
};

const getNavigationScope = (
  node: RuntimeCommandNode,
  routerQuery: {
    orgSlug?: string | string[];
    appSubdomain?: string | string[];
  },
) => {
  if (node.commandPalette?.source === 'recent') {
    // Recent must navigate using the org/project captured when the entry was stored.
    return {
      orgSlug: node.commandPalette.orgSlug,
      appSubdomain: node.commandPalette.appSubdomain,
    };
  }

  if (node.commandPalette?.source === 'switch') {
    return {
      orgSlug: node.commandPalette.orgSlug,
      appSubdomain: node.commandPalette.appSubdomain,
    };
  }

  return {
    orgSlug: routerQuery.orgSlug,
    appSubdomain: routerQuery.appSubdomain,
  };
};

export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const router = useRouter();
  const tree = useFilteredNavTree();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(
    commandPaletteReducer,
    initialCommandPaletteState,
  );
  const { pushRecent } = useRecent();
  const recentItems = useRecentItems(tree);
  const switchItems = useSwitchItems().map(toScoredNode);
  const items = useMemo(() => getVisibleItems(state, tree), [state, tree]);
  const pageItems = useMemo(() => getRootPageItems(tree), [tree]);

  const openCommandPalette = useCallback(() => setOpen(true), []);
  const closeCommandPalette = useCallback(() => setOpen(false), []);

  useCommandPaletteShortcut({
    onToggle: () => setOpen((currentOpen) => !currentOpen),
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOpenShortcut = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault();
        setOpen(false);
        dispatch(reset());
      }
    };

    window.addEventListener('keydown', handleOpenShortcut, true);

    return () => {
      window.removeEventListener('keydown', handleOpenShortcut, true);
    };
  }, [open]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      dispatch(reset());
    }
  }, []);

  const handleNavigate = useCallback(
    (node: CommandNode) => {
      const runtimeNode = node as RuntimeCommandNode;
      const navigationNode = getNavigationNode(runtimeNode);
      const targetScope = getNavigationScope(runtimeNode, router.query);
      const href = resolvePath(navigationNode, targetScope);

      if (!href) {
        return;
      }

      if (
        navigationNode.scope === 'external' ||
        navigationNode.kind === 'doc'
      ) {
        window.open(href, '_blank', 'noopener,noreferrer');
        handleOpenChange(false);
        return;
      }

      const currentOrgSlug = getQueryString(router.query.orgSlug);
      const currentAppSubdomain = getQueryString(router.query.appSubdomain);
      const switchesScope =
        targetScope.orgSlug !== currentOrgSlug ||
        targetScope.appSubdomain !== currentAppSubdomain;

      router.push(href, undefined, { shallow: !switchesScope });
      pushRecent({
        nodeId: navigationNode.id,
        title: navigationNode.title,
        path: navigationNode.path ?? href,
        orgSlug: getQueryString(targetScope.orgSlug) ?? currentOrgSlug,
        appSubdomain:
          getQueryString(targetScope.appSubdomain) ?? currentAppSubdomain,
      });
      handleOpenChange(false);
    },
    [handleOpenChange, pushRecent, router],
  );

  const contextValue = useMemo(
    () => ({ open, setOpen, openCommandPalette, closeCommandPalette }),
    [closeCommandPalette, open, openCommandPalette],
  );

  return (
    <CommandPaletteOpenContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        items={items}
        onDrill={(node) => dispatch(drill(node))}
        onNavigate={handleNavigate}
        onOpenChange={handleOpenChange}
        onPopScope={() => dispatch(popScope())}
        onQueryChange={(query) => dispatch(setQuery(query))}
        open={open}
        pageItems={pageItems}
        query={state.query}
        recentItems={recentItems}
        scopeStack={state.scopeStack}
        switchItems={switchItems}
      />
    </CommandPaletteOpenContext.Provider>
  );
}

export const useCommandPaletteOpen = (): CommandPaletteOpenContextType =>
  useContext(CommandPaletteOpenContext);
