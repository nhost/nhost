import type { GraphQLSchema } from 'graphql';
import { useReducer } from 'react';
import {
  createRootItems,
  expandTreeItem,
  ROOT_ITEM_ID,
} from './schemaTreeItems';
import type { SchemaTreeItems } from './types';

export interface SchemaTreeState {
  schema: GraphQLSchema;
  items: SchemaTreeItems;
  expandedItems: string[];
  focusedItem?: string;
  selectedItems: string[];
}

type SchemaTreeAction =
  | { type: 'expand'; itemId: string }
  | { type: 'collapse'; itemId: string }
  | { type: 'focus'; itemId: string }
  | { type: 'select'; itemIds: string[] }
  | { type: 'reveal'; path: string[] };

function createInitialState(schema: GraphQLSchema): SchemaTreeState {
  return {
    schema,
    items: createRootItems(schema),
    expandedItems: [ROOT_ITEM_ID],
    selectedItems: [],
  };
}

function expandItems(state: SchemaTreeState, itemIds: string[]) {
  return {
    items: itemIds.reduce(
      (items, itemId) => expandTreeItem(state.schema, items, itemId),
      state.items,
    ),
    expandedItems: [...new Set([...state.expandedItems, ...itemIds])],
  };
}

export function schemaTreeReducer(
  state: SchemaTreeState,
  action: SchemaTreeAction,
): SchemaTreeState {
  switch (action.type) {
    case 'expand':
      return { ...state, ...expandItems(state, [action.itemId]) };
    case 'collapse':
      return {
        ...state,
        expandedItems: state.expandedItems.filter(
          (itemId) => itemId !== action.itemId,
        ),
      };
    case 'focus':
      return { ...state, focusedItem: action.itemId };
    case 'select':
      return { ...state, selectedItems: action.itemIds };
    case 'reveal': {
      const itemId = action.path[action.path.length - 1];

      return {
        ...state,
        ...expandItems(state, action.path.slice(0, -1)),
        focusedItem: itemId,
        selectedItems: [itemId],
      };
    }
    default:
      return state;
  }
}

/**
 * Holds the tree's items and view state. Children are added when an item is
 * expanded, either by the user or by revealing a search match.
 */
export default function useSchemaTree(schema: GraphQLSchema) {
  const [state, dispatch] = useReducer(
    schemaTreeReducer,
    schema,
    createInitialState,
  );

  return {
    ...state,
    expand: (itemId: string) => dispatch({ type: 'expand', itemId }),
    collapse: (itemId: string) => dispatch({ type: 'collapse', itemId }),
    focus: (itemId: string) => dispatch({ type: 'focus', itemId }),
    select: (itemIds: string[]) => dispatch({ type: 'select', itemIds }),
    reveal: (path: string[]) => dispatch({ type: 'reveal', path }),
  };
}
