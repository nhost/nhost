import type {
  BaseRelationshipFormValues,
  RemoteSchemaRelationshipFormValues,
  TableRelationshipFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type {
  RelationshipUsing,
  RelationshipUsingForeignKeyConstraintOn,
  RelationshipUsingManualConfiguration,
  RemoteRelationshipDefinition,
  ToRemoteSchemaRelationshipDefinition,
  ToSourceRelationshipDefinition,
} from '@/utils/hasura-api/generated/schemas';
import type {
  LocalRelationshipViewModel,
  RelationshipViewModel,
  RemoteRelationshipViewModel,
} from './relationships';

export const isUsingManualConfiguration = (
  using: RelationshipUsing,
): using is RelationshipUsingManualConfiguration =>
  'manual_configuration' in using;

export const isUsingForeignKeyConstraint = (
  using: RelationshipUsing,
): using is RelationshipUsingForeignKeyConstraintOn =>
  'foreign_key_constraint_on' in using;

export const isLocalRelationshipViewModel = (
  relationship: RelationshipViewModel,
): relationship is LocalRelationshipViewModel => relationship.kind === 'local';

export const isRemoteRelationshipViewModel = (
  relationship: RelationshipViewModel,
): relationship is RemoteRelationshipViewModel =>
  relationship.kind === 'remote';

export function isToRemoteSchemaRelationshipDefinition(
  definition: RemoteRelationshipDefinition,
): definition is { to_remote_schema: ToRemoteSchemaRelationshipDefinition } {
  return 'to_remote_schema' in definition && !('to_source' in definition);
}

export function isToSourceRelationshipDefinition(
  definition: RemoteRelationshipDefinition,
): definition is { to_source: ToSourceRelationshipDefinition } {
  return 'to_source' in definition && !('to_remote_schema' in definition);
}

export function isTableRelationshipFormValues(
  values: BaseRelationshipFormValues,
): values is TableRelationshipFormValues {
  return values.referenceKind === 'table';
}

export function isRemoteSchemaRelationshipFormValues(
  values: BaseRelationshipFormValues,
): values is RemoteSchemaRelationshipFormValues {
  return values.referenceKind === 'remoteSchema';
}
