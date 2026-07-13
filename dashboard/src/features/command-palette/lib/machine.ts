import { flattenTree } from '@/features/command-palette/lib/flatten';
import { scoreNode } from '@/features/command-palette/lib/score';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';

interface CommandPaletteState {
  query: string;
  scopeStack: CommandNode[];
}

type CommandPaletteAction =
  | { type: 'setQuery'; query: string }
  | { type: 'drill'; node: CommandNode }
  | { type: 'popScope' }
  | { type: 'reset' };

export const initialCommandPaletteState: CommandPaletteState = {
  query: '',
  scopeStack: [],
};

export const isContainer = (node: CommandNode) =>
  (node.children?.length ?? 0) > 0;

export const toScoredNode = (node: CommandNode): ScoredNode => ({
  node,
  score: 0,
  titleRanges: [],
});

export const getScopeRoot = (
  state: CommandPaletteState,
  tree: CommandNode,
): CommandNode => state.scopeStack.at(-1) ?? tree;

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

    return {
      query: '',
      scopeStack: [...state.scopeStack, action.node],
    };
  }

  if (action.type === 'popScope') {
    if (state.scopeStack.length === 0) {
      return state;
    }

    return {
      query: state.query,
      scopeStack: state.scopeStack.slice(0, -1),
    };
  }

  return initialCommandPaletteState;
};

// Only nodes that resolve to a destination are search results; structural
// groups like 'project-pages' have no path and would only add noise.
export const getSearchCandidates = (scopeRoot: CommandNode): CommandNode[] =>
  flattenTree(scopeRoot)
    .slice(1)
    .filter((node) => node.path !== undefined);

export const getVisibleItems = (
  state: CommandPaletteState,
  scopeRoot: CommandNode,
  searchCandidates: CommandNode[],
  rootSearchExtras: CommandNode[] = [],
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

      const titleOrder = first.node.title.localeCompare(second.node.title);

      if (titleOrder !== 0) {
        return titleOrder;
      }

      return first.node.id.localeCompare(second.node.id);
    });
};
