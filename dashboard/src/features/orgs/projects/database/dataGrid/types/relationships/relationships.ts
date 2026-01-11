import type {
  RemoteRelationshipDefinition,
  RemoteRelationshipItem,
  SuggestRelationshipsResponseRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';

export interface RelationshipSuggestionViewModel {
  key: string;
  name: string;
  source: string;
  type: 'Array' | 'Object';
  from: string;
  to: string;
  rawSuggestion: SuggestRelationshipsResponseRelationshipsItem;
}

export interface RelationshipViewModel {
  /**
   * Type of the relationship.
   */
  type: 'Array' | 'Object' | 'RemoteSchema';
  /**
   * Name of the relationship.
   */
  name: string;
  /**
   * Name of the source of the relationship.
   */
  fromSource: string;
  /**
   * From element of the relationship.
   * Example: "public.users / id, name"
   */
  fromLabel: string;
  /**
   * To element of the relationship.
   * Example: "public.orders / user_id"
   */
  toLabel: string;
  kind: 'local' | 'remote';
}

export interface LocalRelationshipViewModel extends RelationshipViewModel {
  kind: 'local';
  /**
   * Structural key of the relationship.
   * Used to check if suggested relationships already exist.
   */
  structuralKey: string;
}

export interface RemoteRelationshipViewModel extends RelationshipViewModel {
  kind: 'remote';
  toSource: string;
  definition: RemoteRelationshipDefinition;
}

export type MetadataRemoteRelationship = RemoteRelationshipItem & {
  name?: string;
  definition?: RemoteRelationshipDefinition;
};

/**
 * Represents how a single argument is mapped in a remote field.
 */
export type RemoteFieldArgumentMapping = {
  /** Whether this argument mapping is enabled. */
  enabled: boolean;
  /** The type of mapping: 'column' maps to a source table column, 'static' uses a literal value. */
  type: 'column' | 'static';
  /** The value: either a column name (for 'column') or the static value (for 'static'). */
  value: string;
};

/**
 * Maps field paths to their argument mappings.
 * The outer key is a dot-separated field path (e.g., "users.posts").
 * The inner key is the argument name.
 */
export type RemoteFieldArgumentMappingsByPath = Record<
  string,
  Record<string, RemoteFieldArgumentMapping>
>;
