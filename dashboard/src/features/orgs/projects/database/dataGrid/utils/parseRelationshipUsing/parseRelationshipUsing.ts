import {
  type ParsedForeignKeyConstraintOn,
  parseForeignKeyConstraintOn,
} from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing/foreignKeyConstraintOn';
import {
  type ParsedManualRelationshipConfiguration,
  parseManualRelationshipConfiguration,
} from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing/manualConfiguration';
import { isRecord } from '@/lib/utils';

export type ParsedRelationshipUsing =
  | {
      kind: 'foreignKeyConstraintOn';
      constraintOn: ParsedForeignKeyConstraintOn;
    }
  | {
      kind: 'manualConfiguration';
      configuration: ParsedManualRelationshipConfiguration;
    };

/**
 * Parses a relationship's `using` value, which must hold exactly one of
 * `foreign_key_constraint_on` and `manual_configuration`.
 */
export default function parseRelationshipUsing(
  using: unknown,
): ParsedRelationshipUsing | undefined {
  if (!isRecord(using)) {
    return undefined;
  }

  const hasForeignKeyConstraint = Object.hasOwn(
    using,
    'foreign_key_constraint_on',
  );
  const hasManualConfiguration = Object.hasOwn(using, 'manual_configuration');
  if (hasForeignKeyConstraint === hasManualConfiguration) {
    return undefined;
  }

  if (hasForeignKeyConstraint) {
    const constraintOn = parseForeignKeyConstraintOn(
      using.foreign_key_constraint_on,
    );
    return constraintOn
      ? { kind: 'foreignKeyConstraintOn', constraintOn }
      : undefined;
  }

  const configuration = parseManualRelationshipConfiguration(
    using.manual_configuration,
  );
  return configuration
    ? { kind: 'manualConfiguration', configuration }
    : undefined;
}
