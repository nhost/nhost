import type {
  RelationshipUsing,
  RelationshipUsingForeignKeyConstraintOn,
  RelationshipUsingManualConfiguration,
} from '@/utils/hasura-api/generated/schemas';

export const isUsingManualConfiguration = (
  using: RelationshipUsing,
): using is RelationshipUsingManualConfiguration =>
  'manual_configuration' in using;

export const isUsingForeignKeyConstraint = (
  using: RelationshipUsing,
): using is RelationshipUsingForeignKeyConstraintOn =>
  'foreign_key_constraint_on' in using;
