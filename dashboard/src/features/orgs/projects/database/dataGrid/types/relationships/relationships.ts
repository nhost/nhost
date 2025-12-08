import type {
  RemoteRelationshipDefinition,
  RemoteRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';

export type RelationshipViewModel = {
  key: string;
  /**
   * Structural key of the relationship.
   * Used to check if suggested relationships already exist.
   */
  structuralKey: string;
  /**
   * Type of the relationship.
   */
  type: 'Array' | 'Object' | 'RemoteSchema';
  /**
   * Whether the relationship is a remote relationship
   * (to a remote schema or source).
   */
  isRemote?: boolean;
  /**
   * Name of the relationship.
   */
  name: string;
  /**
   * Name of the source of the relationship.
   * For local relationships, this is the name of the source.
   * For remote relationships, this is the name of the remote schema or source.
   */
  source: string;
  /**
   * Source in which the relationship is defined (Hasura data source).
   */
  originSource: string;
  /**
   * Raw remote relationship metadata (when remote). Used for editing remote relationships.
   */
  rawRemoteRelationship?: MetadataRemoteRelationship;
  /**
   * From element of the relationship.
   * Example: "public.users / id, name"
   */
  from: string;
  /**
   * To element of the relationship.
   * Example: "public.orders / user_id"
   */
  to: string;
};

export type MetadataRemoteRelationship = RemoteRelationshipItem & {
  name?: string;
  definition?: RemoteRelationshipDefinition;
};
