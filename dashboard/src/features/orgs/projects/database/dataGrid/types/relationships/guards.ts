import type {
  RelationshipUsing,
  RelationshipUsingForeignKeyConstraintOn,
  RelationshipUsingManualConfiguration,
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
