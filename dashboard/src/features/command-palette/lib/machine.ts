import {
  flattenScope,
  flattenTree,
} from '@/features/command-palette/lib/flatten';
import { scoreNode } from '@/features/command-palette/lib/score';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';

export interface CommandPaletteState {
  query: string;
  scopeStack: CommandNode[];
}

export type CommandPaletteAction =
  | { type: 'setQuery'; query: string }
  | { type: 'drill'; node: CommandNode }
  | { type: 'popScope' }
  | { type: 'reset' };

export const initialCommandPaletteState: CommandPaletteState = {
  query: '',
  scopeStack: [],
};

export const setQuery = (query: string): CommandPaletteAction => ({
  type: 'setQuery',
  query,
});

export const drill = (node: CommandNode): CommandPaletteAction => ({
  type: 'drill',
  node,
});

export const popScope = (): CommandPaletteAction => ({ type: 'popScope' });

export const reset = (): CommandPaletteAction => ({ type: 'reset' });

const isContainer = (node: CommandNode) => (node.children?.length ?? 0) > 0;

const getCurrentScopeRoot = (
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

const toUnscoredVisibleItem = (node: CommandNode): ScoredNode => ({
  node,
  score: 0,
  titleRanges: [],
});

const getSearchCandidates = (scopeRoot: CommandNode): CommandNode[] =>
  flattenScope(scopeRoot).flatMap((node) => flattenTree(node));

export const getVisibleItems = (
  state: CommandPaletteState,
  tree: CommandNode,
): ScoredNode[] => {
  const scopeRoot = getCurrentScopeRoot(state, tree);
  const query = state.query.trim();

  if (!query) {
    return flattenScope(scopeRoot).map(toUnscoredVisibleItem);
  }

  return getSearchCandidates(scopeRoot)
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
