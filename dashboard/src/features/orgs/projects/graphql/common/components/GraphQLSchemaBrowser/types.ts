import type { TreeItem } from 'react-complex-tree';

export type SchemaTreeNodeKind =
  | 'root'
  | 'operation'
  | 'field'
  | 'argument'
  | 'inputField'
  | 'enumValue'
  | 'unionMember';

export interface SchemaTreeNode {
  kind: SchemaTreeNodeKind;
  name: string;
  /**
   * Printed type of a field, argument or input field, e.g. `[users!]!`.
   */
  typeLabel?: string;
  /**
   * Named type whose members become the node's children.
   */
  typeName?: string;
  /**
   * Type that declares the field, argument's field, input field or value.
   */
  ownerType?: string;
  /**
   * Whether the field is declared directly on a root operation type.
   */
  isRootField?: boolean;
  description?: string | null;
  deprecationReason?: string | null;
  /**
   * Printed default value of an argument or input field, e.g. `10`.
   */
  defaultValue?: string;
}

export interface SchemaSearchResult {
  count: number;
  /**
   * Zero-based index of the match being shown.
   */
  index: number;
}

/**
 * Search a schema view exposes to a search bar outside of it.
 */
export interface SchemaSearchHandle {
  find: (term: string) => SchemaSearchResult;
  /**
   * Shows the next match, or returns `null` when there is nothing to step to.
   */
  next: () => SchemaSearchResult | null;
  previous: () => SchemaSearchResult | null;
}

export type SchemaTreeItem = TreeItem<SchemaTreeNode>;

export type SchemaTreeItems = Record<string, SchemaTreeItem>;
