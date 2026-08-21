import { Search } from 'lucide-react';
import { useRouter } from 'next/router';
import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/v3/button';
import { CommandShortcut } from '@/components/ui/v3/command';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { useCommandPaletteShortcut } from '@/features/command-palette/hooks/useCommandPaletteShortcut';
import { useOrgProjectNodes } from '@/features/command-palette/hooks/useOrgProjectNodes';
import { usePaletteTrees } from '@/features/command-palette/hooks/usePaletteTrees';
import { useRecent } from '@/features/command-palette/hooks/useRecent';
import { useRecentItems } from '@/features/command-palette/hooks/useRecentItems';
import {
  commandPaletteReducer,
  createAffinityRanker,
  getEffectiveScopeStack,
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
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export interface CommandPaletteTriggerProps {
  className?: string;
}

const subscribeToUserAgent = (_onStoreChange: VoidFunction) => () => {};
const getIsMacSnapshot = () =>
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
const getIsMacServerSnapshot = () => false;

const NO_NODES: CommandNode[] = [];
const NO_ITEMS: ScoredNode[] = [];

const getRootPageItems = (tree: CommandNode): ScoredNode[] =>
  (tree.children ?? [])
    .flatMap((child) => (isContainer(child) ? (child.children ?? []) : [child]))
    .map(toScoredNode);

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

export default function CommandPaletteTrigger({
  className,
}: CommandPaletteTriggerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isMac = useSyncExternalStore(
    subscribeToUserAgent,
    getIsMacSnapshot,
    getIsMacServerSnapshot,
  );
  const [state, dispatch] = useReducer(
    commandPaletteReducer,
    initialCommandPaletteState,
  );
  const { orgs } = useOrgs();
  const { recent, pushRecent } = useRecent();
  const isPlatform = useIsPlatform();

  // Must mirror what root search can actually surface in each mode.
  const rootPlaceholder = isPlatform
    ? 'Search organizations, projects, account, support, docs...'
    : 'Search pages, settings, docs...';

  const currentOrgSlug = getSingleQueryParam(router.query.orgSlug);
  const currentAppSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const routeScope = useMemo(
    () => ({ orgSlug: currentOrgSlug, appSubdomain: currentAppSubdomain }),
    [currentOrgSlug, currentAppSubdomain],
  );

  const { tree, displayTree } = usePaletteTrees();
  const recentItems = useRecentItems(tree, recent, open, orgs, currentOrgSlug);
  const orgProjectNodes = useOrgProjectNodes(tree, orgs);
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

  const seededScopeStack = useMemo(() => {
    const orgNode = findOrgNode(orgProjectNodes, routeScope.orgSlug);

    if (!orgNode) {
      return NO_NODES;
    }

    const projectNode = findProjectNode(orgProjectNodes, routeScope);

    return projectNode ? [orgNode, projectNode] : [orgNode];
  }, [orgProjectNodes, routeScope]);

  const scopeStack = getEffectiveScopeStack(state, seededScopeStack);

  const scopeRoot = getScopeRoot({ scopeStack }, displayTree);
  const searchCandidates = useMemo(
    () => (open ? getSearchCandidates(scopeRoot) : NO_NODES),
    [open, scopeRoot],
  );
  const items = useMemo(
    () =>
      open
        ? getVisibleItems(
            { query: state.query, scopeStack },
            scopeRoot,
            searchCandidates,
            orgProjectNodes,
            getAffinity,
          )
        : NO_ITEMS,
    [
      open,
      state.query,
      scopeStack,
      scopeRoot,
      searchCandidates,
      orgProjectNodes,
      getAffinity,
    ],
  );
  const pageItems = useMemo(
    () => (open ? getRootPageItems(displayTree) : NO_ITEMS),
    [open, displayTree],
  );

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
          : routeScope;
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

      dispatch({ type: 'drill', node, ancestors: scopeStack });
    },
    [orgProjectNodes, routeScope, scopeStack],
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      dispatch({ type: 'reset' });
    }
  }, []);

  const openCommandPalette = useCallback(
    () => handleOpenChange(true),
    [handleOpenChange],
  );

  const toggleCommandPalette = useCallback(
    () => handleOpenChange(!open),
    [handleOpenChange, open],
  );

  useCommandPaletteShortcut({ open, onToggle: toggleCommandPalette });

  const handleNavigate = useCallback(
    (node: CommandNode) => {
      const navigationNode = getNavigationNode(node);
      const targetScope = node.commandPalette
        ? {
            orgSlug: node.commandPalette.orgSlug,
            appSubdomain: node.commandPalette.appSubdomain,
          }
        : routeScope;
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

      if (
        navigationNode.scope === 'org' ||
        navigationNode.scope === 'project'
      ) {
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
      }

      handleOpenChange(false);
    },
    [handleOpenChange, pushRecent, router, routeScope],
  );

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Open command palette"
        className={cn(
          'justify-start gap-2 px-3 font-normal text-muted-foreground',
          className,
        )}
        onClick={openCommandPalette}
        variant="outline"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search or navigate to...</span>
        <CommandShortcut>{isMac ? '⌘K' : 'Ctrl K'}</CommandShortcut>
      </Button>
      <CommandPalette
        items={items}
        onDrill={handleDrill}
        onNavigate={handleNavigate}
        onOpenChange={handleOpenChange}
        onPopScope={() => dispatch({ type: 'popScope', stack: scopeStack })}
        onPopTo={(index) =>
          dispatch({ type: 'popToScope', index, stack: scopeStack })
        }
        onQueryChange={(query) => dispatch({ type: 'setQuery', query })}
        open={open}
        orgProjectItems={orgProjectItems}
        pageItems={pageItems}
        query={state.query}
        recentItems={recentItems}
        rootPlaceholder={rootPlaceholder}
        scopeStack={scopeStack}
        scopeTouched={state.scopeTouched}
      />
    </>
  );
}
