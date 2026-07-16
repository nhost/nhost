import { flattenSearchableTree } from '@/features/command-palette/lib/flatten';
import { scoreNode } from '@/features/command-palette/lib/score';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';

interface CommandPaletteState {
  query: string;
  scopeStack: CommandNode[];
  scopeTouched: boolean;
}

type CommandPaletteAction =
  | { type: 'setQuery'; query: string }
  | {
      type: 'drill';
      node: CommandNode;
      ancestors?: CommandNode[];
    }
  | { type: 'popScope'; stack: CommandNode[] }
  | { type: 'popToScope'; index: number; stack: CommandNode[] }
  | { type: 'reset' };

export const initialCommandPaletteState: CommandPaletteState = {
  query: '',
  scopeStack: [],
  scopeTouched: false,
};

export const isContainer = (node: CommandNode) =>
  (node.children?.length ?? 0) > 0;

export const toScoredNode = (node: CommandNode): ScoredNode => ({
  node,
  score: 0,
  titleRanges: [],
});

export const getScopeRoot = (
  state: Pick<CommandPaletteState, 'scopeStack'>,
  tree: CommandNode,
): CommandNode => state.scopeStack.at(-1) ?? tree;

// The stack the palette renders: the route-derived seed until the user
// touches the scope. Pop actions must receive this derived stack back via
// `stack` so they pop what the trail shows, not the unseeded state stack.
export const getEffectiveScopeStack = (
  state: Pick<CommandPaletteState, 'scopeStack' | 'scopeTouched'>,
  seededScopeStack: CommandNode[],
): CommandNode[] => (state.scopeTouched ? state.scopeStack : seededScopeStack);

export const commandPaletteReducer = (
  state: CommandPaletteState,
  action: CommandPaletteAction,
): CommandPaletteState => {
  if (action.type === 'setQuery') {
    return { ...state, query: action.query };
  }

  if (action.type === 'drill') {
    if (!isContainer(action.node)) {
      return state;
    }

    const missingAncestors = (action.ancestors ?? []).filter(
      (ancestor) => !state.scopeStack.some((scope) => scope.id === ancestor.id),
    );

    return {
      query: '',
      scopeStack: [...state.scopeStack, ...missingAncestors, action.node],
      scopeTouched: true,
    };
  }

  if (action.type === 'popScope') {
    if (action.stack.length === 0) {
      return state;
    }

    return {
      query: state.query,
      scopeStack: action.stack.slice(0, -1),
      scopeTouched: true,
    };
  }

  if (action.type === 'popToScope') {
    if (action.index < 0 || action.index >= action.stack.length) {
      return state;
    }

    return {
      query: state.query,
      scopeStack: action.stack.slice(0, action.index),
      scopeTouched: true,
    };
  }

  return initialCommandPaletteState;
};

// Only nodes that resolve to a destination are search results; structural
// groups like 'project-pages' have no path and would only add noise.
// Starting from the children ignores the scope root's own search boundary,
// so drilling into a boundary node still searches inside it.
export const getSearchCandidates = (scopeRoot: CommandNode): CommandNode[] =>
  (scopeRoot.children ?? [])
    .flatMap(flattenSearchableTree)
    .filter((node) => node.path !== undefined);

interface AffinityContext {
  orgSlug?: string;
  appSubdomain?: string;
}

export const createAffinityRanker =
  ({ orgSlug, appSubdomain }: AffinityContext) =>
  (node: CommandNode): number => {
    const metadata = node.commandPalette;

    // Nodes without metadata resolve against the current context.
    if (!metadata) {
      return 0;
    }

    if (metadata.appSubdomain && metadata.appSubdomain === appSubdomain) {
      return 0;
    }

    if (metadata.orgSlug && metadata.orgSlug === orgSlug) {
      return 1;
    }

    return 2;
  };

export const getVisibleItems = (
  state: Pick<CommandPaletteState, 'query' | 'scopeStack'>,
  scopeRoot: CommandNode,
  searchCandidates: CommandNode[],
  rootSearchExtras: CommandNode[] = [],
  getAffinity: (node: CommandNode) => number = () => 0,
): ScoredNode[] => {
  const query = state.query.trim();

  if (!query) {
    return (scopeRoot.children ?? []).map(toScoredNode);
  }

  const candidates =
    state.scopeStack.length === 0
      ? [...searchCandidates, ...rootSearchExtras]
      : searchCandidates;

  return candidates
    .map((node) => ({ node, ...scoreNode(query, node) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => {
      if (first.score !== second.score) {
        return second.score - first.score;
      }

      const affinityOrder = getAffinity(first.node) - getAffinity(second.node);

      if (affinityOrder !== 0) {
        return affinityOrder;
      }

      const titleOrder = first.node.title.localeCompare(second.node.title);

      if (titleOrder !== 0) {
        return titleOrder;
      }

      return first.node.id.localeCompare(second.node.id);
    });
};
